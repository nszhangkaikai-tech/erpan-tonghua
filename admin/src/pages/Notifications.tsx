import { useEffect, useState, useCallback } from 'react';
import { Table, Button, Space, message, Tag, Typography, Modal, Form, Input, Select } from 'antd';
import { ReloadOutlined, PlusOutlined, EditOutlined, DeleteOutlined, SendOutlined, RollbackOutlined } from '@ant-design/icons';
import { callAdmin } from '../api';
import type { NotifDoc } from '../types';

const STATUS_OPTIONS = [
  { label: '草稿', value: 'draft' },
  { label: '已发布', value: 'published' },
  { label: '已撤回', value: 'recalled' },
];

export default function Notifications() {
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<NotifDoc[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<NotifDoc | null>(null);
  const [form] = Form.useForm();

  const load = useCallback(
    async (p = page) => {
      setLoading(true);
      const res = await callAdmin('notif/list', { page: p, pageSize: 20 });
      setLoading(false);
      if (res.success) {
        setList(res.list || []);
        setTotal(res.total || 0);
      } else message.error(res.error || '加载失败');
    },
    [page]
  );

  useEffect(() => { load(1); }, []);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (record: NotifDoc) => {
    setEditing(record);
    form.setFieldsValue({
      title: record.title,
      content: record.content ?? record.body,
      type: record.type,
      status: record.status || 'draft',
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editing) {
        const res = await callAdmin('notif/edit', { id: editing._id, ...values });
        if (res.success) { message.success('更新成功'); setModalOpen(false); load(); }
        else message.error(res.error || '更新失败');
      } else {
        const res = await callAdmin('notif/add', values);
        if (res.success) { message.success('创建成功'); setModalOpen(false); load(); }
        else message.error(res.error || '创建失败');
      }
    } catch { /* validation error */ }
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: '删除通知',
      content: '删除后不可恢复，确定继续？',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        const res = await callAdmin('notif/delete', { id });
        if (res.success) { message.success('已删除'); load(); }
        else message.error(res.error || '删除失败');
      },
    });
  };

  const handlePublish = async (record: NotifDoc) => {
    const res = await callAdmin('notif/publish', { id: record._id });
    if (res.success) { message.success('已发布'); load(); }
    else message.error(res.error || '发布失败');
  };

  const handleRecall = async (record: NotifDoc) => {
    const res = await callAdmin('notif/recall', { id: record._id });
    if (res.success) { message.success('已撤回'); load(); }
    else message.error(res.error || '撤回失败');
  };

  const columns = [
    { title: 'ID', dataIndex: '_id', key: '_id', ellipsis: true, render: (v: string) => v || '-' },
    { title: '标题', dataIndex: 'title', key: 'title', render: (v: string) => v || <Typography.Text type="secondary">（无标题）</Typography.Text> },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (v: string) => {
        const color = v === 'system' ? 'blue' : v === 'story' ? 'green' : v === 'voice' ? 'purple' : v === 'card' ? 'orange' : 'default';
        return <Tag color={color}>{v || '-'}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => {
        const color = v === 'published' ? 'green' : v === 'recalled' ? 'red' : v === 'draft' ? 'default' : 'default';
        const label = v === 'published' ? '已发布' : v === 'recalled' ? '已撤回' : v === 'draft' ? '草稿' : (v || '-');
        return <Tag color={color}>{label}</Tag>;
      },
    },
    {
      title: '已读',
      dataIndex: 'isRead',
      key: 'isRead',
      render: (v: boolean, r: NotifDoc) => <Tag color={(v ?? r.read) ? 'green' : 'orange'}>{(v ?? r.read) ? '已读' : '未读'}</Tag>,
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
      render: (_: any, record: NotifDoc) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>编辑</Button>
          {record.status !== 'published' && (
            <Button size="small" type="primary" icon={<SendOutlined />} onClick={() => handlePublish(record)}>发布</Button>
          )}
          {record.status === 'published' && (
            <Button size="small" icon={<RollbackOutlined />} onClick={() => handleRecall(record)}>撤回</Button>
          )}
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record._id!)}>删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          通知管理
        </Typography.Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => load(1)} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新建通知
          </Button>
        </Space>
      </Space>

      <Table
        rowKey={(r: any) => r._id || Math.random()}
        dataSource={list}
        columns={columns as any}
        loading={loading}
        pagination={{
          current: page,
          total,
          pageSize: 20,
          onChange: (p) => { setPage(p); load(p); },
        }}
      />

      <Modal
        title={editing ? '编辑通知' : '新建通知'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText="提交"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入通知标题' }]}>
            <Input placeholder="通知标题" />
          </Form.Item>
          <Form.Item name="content" label="内容" rules={[{ required: true, message: '请输入通知内容' }]}>
            <Input.TextArea rows={4} placeholder="通知内容" />
          </Form.Item>
          <Form.Item name="type" label="类型" initialValue="system">
            <Select>
              <Select.Option value="system">系统</Select.Option>
              <Select.Option value="story">故事</Select.Option>
              <Select.Option value="voice">声纹</Select.Option>
              <Select.Option value="card">卡密</Select.Option>
              <Select.Option value="referral">邀请</Select.Option>
            </Select>
          </Form.Item>
          {editing && (
            <Form.Item name="status" label="状态">
              <Select>
                {STATUS_OPTIONS.map(o => <Select.Option key={o.value} value={o.value}>{o.label}</Select.Option>)}
              </Select>
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
}
