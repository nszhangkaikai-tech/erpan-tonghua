import { useEffect, useState, useCallback } from 'react';
import { Table, Input, Button, Space, message, Tag, Typography, Popconfirm } from 'antd';
import { SearchOutlined, ReloadOutlined, DeleteOutlined } from '@ant-design/icons';
import { callAdmin } from '../api';
import type { VoiceDoc } from '../types';

export default function VoiceClones() {
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<VoiceDoc[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [keywordInput, setKeywordInput] = useState('');

  const load = useCallback(
    async (p = page, kw = keyword) => {
      setLoading(true);
      const res = await callAdmin('voice/list', { page: p, pageSize: 20, keyword: kw || undefined });
      setLoading(false);
      if (res.success) {
        setList(res.list || []);
        setTotal(res.total || 0);
      } else message.error(res.error || '加载失败');
    },
    [page, keyword]
  );

  useEffect(() => {
    load(1, '');
  }, []);

  const onSearch = () => {
    setKeyword(keywordInput);
    setPage(1);
    load(1, keywordInput);
  };

  const onDelete = async (id: string) => {
    const res = await callAdmin('voice/delete', { id });
    if (res.success) {
      message.success('已删除');
      load();
    } else message.error(res.error || '删除失败');
  };

  const columns = [
    { title: 'ID', dataIndex: '_id', key: '_id', ellipsis: true, render: (v: string) => v || '-' },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (v: string) => v || <Typography.Text type="secondary">未命名</Typography.Text>,
    },
    { title: 'OpenID', dataIndex: 'openid', key: 'openid', ellipsis: true, render: (v: string) => v || '-' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <Tag color={(v === 'ready' ? 'green' : 'default')}>{v || 'unknown'}</Tag>,
    },
    {
      title: '音频',
      dataIndex: 'audioUrl',
      key: 'audioUrl',
      render: (v: string) => (v ? <audio src={v} controls style={{ width: 160 }} /> : '-'),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => (v ? new Date(v).toLocaleString() : '-'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, r: VoiceDoc) => (
        <Popconfirm title="确认删除该声纹？" onConfirm={() => r._id && onDelete(r._id)}>
          <Button danger size="small" icon={<DeleteOutlined />}>
            删除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          声纹管理
        </Typography.Title>
        <Space>
          <Input
            placeholder="搜索名称"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onPressEnter={onSearch}
            style={{ width: 220 }}
          />
          <Button icon={<SearchOutlined />} onClick={onSearch}>
            搜索
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => load(1, '')}>
            重置
          </Button>
        </Space>
      </Space>

      <Table
        rowKey={(r: any) => r._id || Math.random()}
        dataSource={list}
        columns={columns}
        loading={loading}
        pagination={{
          current: page,
          total,
          pageSize: 20,
          onChange: (p) => {
            setPage(p);
            load(p);
          },
        }}
      />
    </div>
  );
}
