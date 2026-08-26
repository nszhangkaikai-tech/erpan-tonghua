import { useEffect, useState } from 'react';
import { Table, Button, Space, message, Tag, Typography, Modal, Form, Input } from 'antd';
import { ReloadOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { callAdmin } from '../api';
import type { AdminDoc } from '../types';

export default function Admins() {
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<AdminDoc[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AdminDoc | null>(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    const res = await callAdmin('admins/list');
    setLoading(false);
    if (res.success) setList(res.list || []);
    else message.error(res.error || '加载失败');
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (record: AdminDoc) => {
    setEditing(record);
    form.setFieldsValue({ username: record.username, password: '' });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editing) {
        const res = await callAdmin('admins/update', { id: editing._id, ...values });
        if (res.success) { message.success('更新成功'); setModalOpen(false); load(); }
        else message.error(res.error || '更新失败');
      } else {
        const res = await callAdmin('register', { ...values });
        if (res.success) { message.success('创建成功'); setModalOpen(false); load(); }
        else message.error(res.error || '创建失败');
      }
    } catch { /* validation error */ }
  };

  const handleDelete = async (id: string, username: string) => {
    Modal.confirm({
      title: `删除管理员【${username}】`,
      content: '删除后该账号将无法登录，确定继续？',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        const res = await callAdmin('admins/delete', { id });
        if (res.success) { message.success('已删除'); load(); }
        else message.error(res.error || '删除失败');
      },
    });
  };

  const columns = [
    { title: '用户名', dataIndex: 'username', key: 'username', render: (v: string) => v || '-' },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => (v ? new Date(v).toLocaleString() : '-'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: AdminDoc) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>编辑</Button>
          {record.username !== 'admin' && (
            <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record._id!, record.username!)}>删除</Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>管理员管理</Typography.Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增管理员</Button>
        </Space>
      </Space>

      <Table
        rowKey={(r: any) => r._id || Math.random()}
        dataSource={list}
        columns={columns as any}
        loading={loading}
        pagination={{ pageSize: 20 }}
      />

      <Modal
        title={editing ? '编辑管理员' : '新增管理员'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText="提交"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input placeholder="登录账号" disabled={!!editing} />
          </Form.Item>
          <Form.Item name="password" label={editing ? '新密码（留空不修改）' : '密码'} rules={editing ? [] : [{ required: true, message: '请输入密码' }]}>
            <Input.Password placeholder={editing ? '留空则不修改' : '至少5位'} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
