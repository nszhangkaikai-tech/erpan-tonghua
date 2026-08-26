import { useEffect, useState } from 'react';
import { Table, Button, Space, message, Tag, Typography, Alert, Modal, Form, Input, InputNumber, Select } from 'antd';
import { ReloadOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { callAdmin } from '../api';
import type { CdkeyDoc } from '../types';

export default function Cdkeys() {
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<CdkeyDoc[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    const res = await callAdmin('cdkeys/list');
    setLoading(false);
    if (res.success) setList(res.list || []);
    else message.error(res.error || '加载失败');
  };

  useEffect(() => { load(); }, []);

  const brokenRecords = list.filter((c) => !c.code && !c.type);
  const hasFieldLoss = brokenRecords.length > 0;

  const handleCleanup = async () => {
    setCleaning(true);
    try {
      const res = await callAdmin('cdkeys/cleanup');
      if (res.success) {
        message.success(`已清理 ${res.removed} 条残缺记录`);
        load();
      } else message.error(res.error || '清理失败');
    } finally {
      setCleaning(false);
    }
  };

  const openCreate = () => {
    form.resetFields();
    setModalOpen(true);
  };

  const handleGenerate = async () => {
    try {
      const values = await form.validateFields();
      if (values.batch) {
        const res = await callAdmin('cdkeys/batch-generate', values);
        if (res.success) { message.success(`批量生成 ${res.count} 个兑换码`); setModalOpen(false); load(); }
        else message.error(res.error || '批量生成失败');
      } else {
        const res = await callAdmin('cdkeys/generate', values);
        if (res.success) { message.success('生成成功'); setModalOpen(false); load(); }
        else message.error(res.error || '生成失败');
      }
    } catch { /* validation error */ }
  };

  const handleDelete = async (record: CdkeyDoc) => {
    const label = record.code || record._id?.slice(0, 8) || '该记录';
    Modal.confirm({
      title: `删除兑换码【${label}】`,
      content: '删除后不可恢复，确定继续？',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        // 残缺记录无 code，传 _id 让后端按 _id 定位删除
        const res = await callAdmin('cdkeys/delete', { code: record.code, _id: record._id });
        if (res.success) { message.success('已删除'); load(); }
        else message.error(res.error || '删除失败');
      },
    });
  };

  const columns = [
    { title: 'ID', dataIndex: '_id', key: '_id', ellipsis: true, render: (v: string) => v || '-' },
    {
      title: '兑换码',
      dataIndex: 'code',
      key: 'code',
      render: (v: string) => v || <Typography.Text type="secondary">（字段缺失）</Typography.Text>,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (v: string) => (v ? <Tag>{v}</Tag> : '-'),
    },
    {
      title: '额度',
      dataIndex: 'quota',
      key: 'quota',
      render: (v: number) => (v != null ? v : '-'),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => (v ? <Tag color="green">{v}</Tag> : '-'),
    },
    {
      title: '渠道',
      dataIndex: 'channel',
      key: 'channel',
      render: (v: string) => v || '-',
    },
    {
      title: '过期时间',
      dataIndex: 'expiresAt',
      key: 'expiresAt',
      render: (v: string) => (v ? new Date(v).toLocaleString() : '-'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: CdkeyDoc) => (
        <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)}>删除</Button>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          兑换码管理
        </Typography.Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            生成兑换码
          </Button>
        </Space>
      </Space>

      {hasFieldLoss && (
        <Alert
          style={{ marginBottom: 16 }}
          type="warning"
          showIcon
          message={`检测到 ${brokenRecords.length} 条兑换码记录字段不完整`}
          description="早期写入异常曾导致部分记录仅保留 _id，无法兑换。建议清理后重新生成。"
          action={
            <Button size="small" danger loading={cleaning} onClick={handleCleanup}>
              清理残缺记录
            </Button>
          }
        />
      )}

      <Table
        rowKey={(r: any) => r._id || Math.random()}
        dataSource={list}
        columns={columns}
        loading={loading}
        pagination={{ pageSize: 20 }}
      />

      <Modal
        title="生成兑换码"
        open={modalOpen}
        onOk={handleGenerate}
        onCancel={() => setModalOpen(false)}
        okText="生成"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="batch" label="模式" valuePropName="checked" initialValue={false}>
            <Select>
              <Select.Option value={false}>单个生成</Select.Option>
              <Select.Option value={true}>批量生成</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.batch !== curr.batch}>
            {({ getFieldValue }) => {
              const batch = getFieldValue('batch');
              return (
                <>
                  {!batch && (
                    <Form.Item name="code" label="兑换码" rules={[{ required: true, message: '请输入兑换码' }]}>
                      <Input placeholder="例如：STORY88" />
                    </Form.Item>
                  )}
                  {batch && (
                    <Form.Item name="prefix" label="前缀（可选）">
                      <Input placeholder="例如：VIP" />
                    </Form.Item>
                  )}
                  <Form.Item name="type" label="类型" rules={[{ required: true, message: '请选择类型' }]}>
                    <Select placeholder="请选择">
                      <Select.Option value="times">次数</Select.Option>
                      <Select.Option value="vip">VIP</Select.Option>
                    </Select>
                  </Form.Item>
                  <Form.Item name="value" label="额度" rules={[{ required: true, message: '请输入额度' }]}>
                    <InputNumber min={1} max={9999} style={{ width: '100%' }} placeholder={batch ? '10' : '10'} />
                  </Form.Item>
                  <Form.Item name="channel" label="渠道">
                    <Input placeholder="例如：小红书社群引流" />
                  </Form.Item>
                  {batch && (
                    <Form.Item name="count" label="数量" rules={[{ required: true, message: '请输入数量' }]}>
                      <InputNumber min={1} max={100} style={{ width: '100%' }} placeholder="10" />
                    </Form.Item>
                  )}
                </>
              );
            }}
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
