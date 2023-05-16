/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { ButtonGroup, Button, Tag, Intent } from '@blueprintjs/core';
import { pick, get } from 'lodash';
import { PageLoading, PageHeader, Table, ColumnType, IconButton, Card, Inspector, Dialog } from '@/components';
import { DEVLAKE_ENDPOINT } from '@/config';
import { formatTime } from '@/utils';
import * as API from '../api';
import * as S from './styled';
import { PipelineTasks, usePipeline } from '../components';
import { useAutoRefresh } from '@/hooks';
import { PipelineType, StatusEnum } from '../types';
import { saveAs } from 'file-saver';
import { PipelineStatus } from '../components/status';
import { PipelineDuration } from '../components/duration';
import { getPipelines } from './api';

export const PipelineHomePage = () => {
  const history = useHistory();

  const options = useMemo(() => {
    return [
      { label: 'Successed', value: 'successed' },
      { label: 'Failed', value: 'failed' },
    ];
  }, []);

  const [type, setType] = useState('all');
  const handleCreate = () => history.push('/blueprints/create');

  const [dataSource, setDataSource] = useState<PipelineType[]>([]);
  const [JSON, setJSON] = useState<any>(null);
  const [ID, setID] = useState<ID | null>(null);
  const [name, setName] = useState<string>('');

  const { version } = usePipeline();

  const { loading, data: pipelines } = useAutoRefresh<PipelineType[]>(
    async () => {
      const res = await getPipelines({
        page: 1,
        pageSize: 200,
      });
      return res.pipelines;
    },
    [version],
    {
      cancel: (data) =>
        !!(
          data &&
          data.every((it) =>
            [StatusEnum.COMPLETED, StatusEnum.PARTIAL, StatusEnum.CANCELLED, StatusEnum.FAILED].includes(it.status),
          )
        ),
    },
  );

  useEffect(() => {
    pipelines &&
      setDataSource(
        pipelines.filter((pl) => {
          switch (type) {
            case 'all':
              return true;
            case 'successed':
              return pl.status === StatusEnum.COMPLETED;
            case 'failed':
              return pl.status === StatusEnum.FAILED;
            default:
              return true;
          }
        }),
      );
  }, [pipelines, type]);

  const handleShowJSON = (row: PipelineType) => {
    setName(get(row, 'name', ''));
    setJSON(pick(row, ['id', 'name', 'plan', 'skipOnFail']));
  };

  const handleDownloadLog = async (id: ID) => {
    const res = await API.getPipelineLog(id);
    if (res) {
      saveAs(`${DEVLAKE_ENDPOINT}/pipelines/${id}/logging.tar.gz`, 'logging.tar.gz');
    }
  };

  const handleShowDetails = (ID: ID, row: PipelineType) => {
    setName(get(row, 'name', ''));
    setID(ID);
  };

  const columns = useMemo(
    () =>
      [
        {
          title: 'Pipeline Name',
          dataIndex: 'name',
          key: 'name',
        },
        {
          title: 'Project',
          dataIndex: 'project',
          key: 'project',
          render: (_, pipeline: PipelineType) =>
            get(pipeline, 'plan[0][0].options.projectMappings[0].projectName', '-'),
        },
        {
          title: 'Status',
          dataIndex: 'status',
          key: 'status',
          render: (val) => <PipelineStatus status={val} />,
        },
        {
          title: 'Started at',
          dataIndex: 'beganAt',
          key: 'beganAt',
          align: 'center',
          render: (val: string | null) => (val ? formatTime(val) : '-'),
        },
        {
          title: 'Completed at',
          dataIndex: 'finishedAt',
          key: 'finishedAt',
          align: 'center',
          render: (val: string | null) => (val ? formatTime(val) : '-'),
        },
        {
          title: 'Duration',
          dataIndex: ['status', 'beganAt', 'finishedAt'],
          key: 'duration',
          align: 'center',
          render: ({ status, beganAt, finishedAt }) => (
            <PipelineDuration status={status} beganAt={beganAt} finishedAt={finishedAt} />
          ),
        },
        {
          title: '',
          dataIndex: 'id',
          key: 'action',
          align: 'center',
          render: (id: ID, row) => (
            <ButtonGroup>
              <IconButton icon="code" tooltip="View JSON" onClick={() => handleShowJSON(row)} />
              <IconButton icon="document" tooltip="Download Logs" onClick={() => handleDownloadLog(id)} />
              <IconButton icon="chevron-right" tooltip="View Details" onClick={() => handleShowDetails(id, row)} />
            </ButtonGroup>
          ),
        },
      ] as ColumnType<PipelineType>,
    [],
  );

  if (loading) {
    return <PageLoading />;
  }

  return (
    <PageHeader breadcrumbs={[{ name: 'Pipeline', path: '/pipelines' }]}>
      <S.Wrapper>
        <div className="action">
          <ButtonGroup>
            <Button intent={type === 'all' ? Intent.PRIMARY : Intent.NONE} text="All" onClick={() => setType('all')} />
            {options.map(({ label, value }) => (
              <Button
                key={value}
                intent={type === value ? Intent.PRIMARY : Intent.NONE}
                text={label}
                onClick={() => setType(value)}
              />
            ))}
          </ButtonGroup>
        </div>
        <div>
          <Table
            columns={columns}
            dataSource={dataSource}
            noData={{
              text: `There is no ${type} pipeline.`,
            }}
          />
          {JSON && (
            <Inspector
              isOpen
              title={name}
              data={JSON}
              onClose={() => {
                setName('');
                setJSON(null);
              }}
            />
          )}
          {ID && (
            <Dialog
              style={{ width: 720 }}
              isOpen
              title={name}
              footer={null}
              onCancel={() => {
                setName('');
                setID(null);
              }}
            >
              <PipelineTasks id={ID} />
            </Dialog>
          )}
        </div>
      </S.Wrapper>
    </PageHeader>
  );
};
