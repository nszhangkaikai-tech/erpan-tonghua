import { useEffect, useState } from 'react';
import {
  Card,
  Button,
  Space,
  Table,
  Tag,
  Switch,
  Modal,
  Form,
  Input,
  InputNumber,
  message,
  Popconfirm,
  Typography,
} from 'antd';
import {
  ReloadOutlined,
  PlusOutlined,
  SaveOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { callAdmin } from '../api';

// ========================
// 类型
// ========================
interface Author {
  id: string;
  name: string;
  title?: string;
  identity?: string;
  style?: string;
  bio?: string;
  enabled?: boolean;
  sortOrder?: number;
  [k: string]: any;
}

// ========================
// 作者维护页（增删改查）
// ========================
export default function Authors() {
  const [list, setList] = useState<Author[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Author | null>(null);
  const [form] = Form.useForm<Author>();

  const load = async () => {
    setLoading(true);
    try {
      const res = await callAdmin('author/list');
      if (res.success) {
        setList((res.list || []).slice().sort((a: Author, b: Author) => (a.sortOrder || 0) - (b.sortOrder || 0)));
      } else {
        message.error(res.error || '加载失败');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ enabled: true, sortOrder: list.length + 1 });
    setOpen(true);
  };
  const openEdit = (a: Author) => {
    setEditing(a);
    form.setFieldsValue(a);
    setOpen(true);
  };

  const handleOk = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      if (editing) {
        const res = await callAdmin('author/update', {
          id: editing.id,
          name: v.name,
          title: v.title,
          identity: v.identity,
          style: v.style,
          bio: v.bio,
          enabled: v.enabled !== false,
          sortOrder: Number(v.sortOrder) || 0,
        });
        if (res.success) {
          message.success('作者已更新');
          setOpen(false);
          load();
        } else {
          message.error(res.error || '更新失败');
        }
      } else {
        const res = await callAdmin('author/add', {
          name: v.name,
          title: v.title,
          identity: v.identity,
          style: v.style,
          bio: v.bio,
          enabled: v.enabled !== false,
          sortOrder: Number(v.sortOrder) || 0,
        });
        if (res.success) {
          message.success('作者已新增');
          setOpen(false);
          load();
        } else {
          message.error(res.error || '新增失败');
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const res = await callAdmin('author/delete', { id });
    if (res.success) {
      message.success('作者已删除');
      load();
    } else {
      message.error(res.error || '删除失败');
    }
  };

  const toggleEnabled = async (a: Author, val: boolean) => {
    const res = await callAdmin('author/update', {
      id: a.id,
      name: a.name,
      title: a.title,
      identity: a.identity,
      style: a.style,
      bio: a.bio,
      enabled: val,
      sortOrder: a.sortOrder,
    });
    if (res.success) load();
    else message.error(res.error || '状态更新失败');
  };

  const columns = [
    { title: '名称', dataIndex: 'name', width: 140, render: (v: string) => v || '-' },
    { title: '头衔', dataIndex: 'title', width: 140, render: (v: string) => v || '-' },
    {
      title: '身份设定（提示词）',
      dataIndex: 'identity',
      ellipsis: true,
      render: (v: string) => v || <Typography.Text type="secondary">未设置</Typography.Text>,
    },
    {
      title: '风格（提示词）',
      dataIndex: 'style',
      ellipsis: true,
      render: (v: string) => v || <Typography.Text type="secondary">未设置</Typography.Text>,
    },
    {
      title: '简介',
      dataIndex: 'bio',
      ellipsis: true,
      render: (v: string) => v || '-',
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      width: 80,
      render: (e: any, r: Author) => (
        <Switch checked={e !== false} onChange={(val) => toggleEnabled(r, val)} />
      ),
    },
    {
      title: '排序',
      dataIndex: 'sortOrder',
      width: 80,
      sorter: (a: Author, b: Author) => (a.sortOrder || 0) - (b.sortOrder || 0),
    },
    {
      title: '操作',
      width: 140,
      fixed: 'right' as const,
      render: (_: any, r: Author) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>
            编辑
          </Button>
          <Popconfirm title="确认删除该作者？" onConfirm={() => handleDelete(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }} wrap>
        <Typography.Title level={4} style={{ margin: 0 }}>
          故事作者（维护增删改查）
        </Typography.Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新增作者
          </Button>
        </Space>
      </Space>

      <Card>
        <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
          此处维护「故事作者」库，供小程序生成向导第二步选择。每位作者的「身份设定」与「风格」将自动附加到后续故事生成提示词中；
          新建作者会同步写入云数据库（<Tag>storyAuthors</Tag> 集合），小程序端实时可见。
        </Typography.Paragraph>
        <Table<Author>
          rowKey="id"
          dataSource={list}
          columns={columns}
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: [10, 20, 50] }}
          scroll={{ x: 900 }}
        />
      </Card>

      <Modal
        title={editing ? '编辑作者' : '新增作者'}
        open={open}
        onOk={handleOk}
        onCancel={() => setOpen(false)}
        confirmLoading={saving}
        destroyOnClose
        width={640}
      >
        <Form form={form} layout="vertical">
          <Space size="large" style={{ display: 'flex', flexWrap: 'wrap' }}>
            <Form.Item
              label="作者名称"
              name="name"
              rules={[{ required: true, message: '请输入作者名称' }]}
              style={{ width: 240 }}
            >
              <Input placeholder="如 科普探险叔叔" maxLength={40} />
            </Form.Item>
            <Form.Item label="头衔" name="title" style={{ width: 200 }}>
              <Input placeholder="如 科普启蒙作家" maxLength={40} />
            </Form.Item>
            <Form.Item label="排序" name="sortOrder" style={{ width: 120 }}>
              <InputNumber min={0} max={999} style={{ width: '100%' }} />
            </Form.Item>
          </Space>
          <Form.Item label="身份设定（附加到故事提示词）" name="identity">
            <Input.TextArea
              rows={3}
              maxLength={500}
              placeholder="如：你是一位热爱自然与科学的儿童科普作家，能把世界的奇妙讲得既准确又好玩。"
            />
          </Form.Item>
          <Form.Item label="风格（附加到故事提示词）" name="style">
            <Input.TextArea
              rows={3}
              maxLength={500}
              placeholder="如：把知识点藏进冒险故事里，用孩子能懂的比喻解释自然现象，激发好奇心。"
            />
          </Form.Item>
          <Form.Item label="简介" name="bio">
            <Input.TextArea rows={2} maxLength={300} placeholder="后台展示用的简短说明" />
          </Form.Item>
          <Form.Item label="启用" name="enabled" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
