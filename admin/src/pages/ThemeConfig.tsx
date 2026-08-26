import { useEffect, useState } from 'react';
import {
  Card,
  Tabs,
  Button,
  Space,
  Table,
  Tag,
  Switch,
  Modal,
  Divider,
  Form,
  Input,
  InputNumber,
  Select,
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
  DatabaseOutlined,
} from '@ant-design/icons';
import { callAdmin } from '../api';

// ========================
// 类型
// ========================
interface Category {
  key: string;
  name: string;
  sortOrder?: number;
}
interface ThemeItem {
  key: string;
  category: string;
  mood?: string;
  palette?: string;
  arc?: string;
  educationalGoals?: string[];
  sortOrder?: number;
  enabled?: boolean;
}
interface SceneItem {
  key: string;
  setting?: string;
  details?: string;
  sortOrder?: number;
  enabled?: boolean;
}

// ========================
// 分类 Tab
// ========================
function CategoryTab({
  categories,
  setCategories,
  loading,
}: {
  categories: Category[];
  setCategories: (updater: (prev: Category[]) => Category[]) => void;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form] = Form.useForm<Category>();

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ sortOrder: categories.length + 1 });
    setOpen(true);
  };
  const openEdit = (c: Category) => {
    setEditing(c);
    form.setFieldsValue(c);
    setOpen(true);
  };
  const handleOk = async () => {
    const v = await form.validateFields();
    if (editing) {
      setCategories(prev => prev.map(c => (c.key === editing.key ? { ...c, ...v } : c)));
    } else {
      if (categories.some(c => c.key === v.key)) {
        message.error('分类 key 已存在');
        return;
      }
      setCategories(prev => [...prev, v]);
    }
    setOpen(false);
  };
  const handleDelete = (key: string) => {
    setCategories(prev => prev.filter(c => c.key !== key));
  };

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          新增分类
        </Button>
      </Space>
      <Table<Category>
        rowKey="key"
        dataSource={[...categories].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))}
        pagination={false}
        loading={loading}
        columns={[
          { title: '分类 Key', dataIndex: 'key', width: 160 },
          { title: '分类名称', dataIndex: 'name' },
          { title: '排序', dataIndex: 'sortOrder', width: 90, sorter: (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) },
          {
            title: '操作',
            width: 160,
            render: (_: any, r: Category) => (
              <Space>
                <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
                <Popconfirm title="确认删除该分类？" onConfirm={() => handleDelete(r.key)}>
                  <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
      <Modal
        title={editing ? '编辑分类' : '新增分类'}
        open={open}
        onOk={handleOk}
        onCancel={() => setOpen(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item label="分类 Key（唯一，英文）" name="key" rules={[{ required: true, message: '请输入分类 Key' }]}>
            <Input disabled={!!editing} placeholder="如 emotion" maxLength={40} />
          </Form.Item>
          <Form.Item label="分类名称" name="name" rules={[{ required: true, message: '请输入分类名称' }]}>
            <Input placeholder="如 情绪与心理" maxLength={40} />
          </Form.Item>
          <Form.Item label="排序" name="sortOrder">
            <InputNumber min={0} max={999} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// ========================
// 主题 Tab
// ========================
function ThemeTab({
  themes,
  setThemes,
  categories,
  setCategories,
  loading,
}: {
  themes: ThemeItem[];
  setThemes: (updater: (prev: ThemeItem[]) => ThemeItem[]) => void;
  categories: Category[];
  setCategories: (updater: (prev: Category[]) => Category[]) => void;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ThemeItem | null>(null);
  const [form] = Form.useForm<ThemeItem>();
  // 新建主题时内联新增分类
  const [catModal, setCatModal] = useState(false);
  const [catForm] = Form.useForm<Category>();

  const openNewCategory = () => {
    catForm.resetFields();
    catForm.setFieldsValue({ sortOrder: categories.length + 1 });
    setCatModal(true);
  };
  const handleNewCategory = async () => {
    const v = await catForm.validateFields();
    if (categories.some(c => c.key === v.key)) {
      message.error('分类 key 已存在');
      return;
    }
    const newCat: Category = { ...v, sortOrder: categories.length + 1 };
    setCategories(prev => [...prev, newCat]);
    form.setFieldsValue({ category: newCat.key });
    setCatModal(false);
    message.success(`已新建分类「${newCat.name}」并选中`);
  };

  const categoryName = (key: string) =>
    categories.find(c => c.key === key)?.name || key || '未分类';

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      category: categories[0]?.key,
      enabled: true,
      educationalGoals: [],
      sortOrder: themes.length + 1,
    });
    setOpen(true);
  };
  const openEdit = (t: ThemeItem) => {
    setEditing(t);
    form.setFieldsValue(t);
    setOpen(true);
  };
  const handleOk = async () => {
    const v = await form.validateFields();
    if (editing) {
      setThemes(prev => prev.map(t => (t.key === editing.key ? { ...t, ...v } : t)));
    } else {
      if (themes.some(t => t.key === v.key)) {
        message.error('主题 key（名称）已存在');
        return;
      }
      setThemes(prev => [...prev, v]);
    }
    setOpen(false);
  };
  const handleDelete = (key: string) => {
    setThemes(prev => prev.filter(t => t.key !== key));
  };
  const toggleEnabled = (key: string, val: boolean) => {
    setThemes(prev => prev.map(t => (t.key === key ? { ...t, enabled: val } : t)));
  };

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          新增主题
        </Button>
        <Typography.Text type="secondary">共 {themes.length} 个主题</Typography.Text>
      </Space>
      <Table<ThemeItem>
        rowKey="key"
        dataSource={[...themes].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))}
        pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: [10, 20, 50] }}
        loading={loading}
        scroll={{ x: 900 }}
        columns={[
          { title: '主题名(key)', dataIndex: 'key', width: 180, fixed: 'left' },
          {
            title: '分类',
            dataIndex: 'category',
            width: 130,
            render: (c: string) => <Tag color="blue">{categoryName(c)}</Tag>,
            filters: categories.map(c => ({ text: c.name, value: c.key })),
            onFilter: (val, r) => r.category === val,
          },
          { title: '氛围', dataIndex: 'mood', ellipsis: true },
          { title: '配色', dataIndex: 'palette', ellipsis: true },
          {
            title: '教育目标',
            dataIndex: 'educationalGoals',
            width: 220,
            render: (g?: string[]) => (
              <Space size={4} wrap>
                {(g || []).map(x => (
                  <Tag key={x} color="orange">{x}</Tag>
                ))}
              </Space>
            ),
          },
          {
            title: '启用',
            dataIndex: 'enabled',
            width: 80,
            render: (e: any, r: ThemeItem) => (
              <Switch checked={e !== false} onChange={val => toggleEnabled(r.key, val)} />
            ),
          },
          {
            title: '操作',
            width: 140,
            fixed: 'right',
            render: (_: any, r: ThemeItem) => (
              <Space>
                <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
                <Popconfirm title="确认删除该主题？" onConfirm={() => handleDelete(r.key)}>
                  <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
      <Modal
        title={editing ? '编辑主题' : '新增主题'}
        open={open}
        onOk={handleOk}
        onCancel={() => setOpen(false)}
        destroyOnClose
        width={640}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="主题名（key，唯一，作为前端展示名与后端检索键）" name="key" rules={[{ required: true, message: '请输入主题名' }]}>
            <Input disabled={!!editing} placeholder="如 睡前安抚" maxLength={40} />
          </Form.Item>
          <Form.Item label="所属分类" name="category" rules={[{ required: true, message: '请选择分类' }]}>
            <Select
              options={categories.map(c => ({ value: c.key, label: c.name }))}
              placeholder="选择分类"
              dropdownRender={(menu) => (
                <>
                  {menu}
                  <Divider style={{ margin: '8px 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
                    <Button type="link" icon={<PlusOutlined />} onClick={openNewCategory}>
                      新建分类
                    </Button>
                  </div>
                </>
              )}
            />
          </Form.Item>
          <Form.Item label="氛围描述" name="mood">
            <Input.TextArea rows={2} maxLength={200} placeholder="如 安全、宁静、被温柔陪伴" />
          </Form.Item>
          <Form.Item label="配色建议" name="palette">
            <Input maxLength={200} placeholder="如 月光蓝、奶油白、柔和薰衣草紫" />
          </Form.Item>
          <Form.Item label="故事走向(arc)" name="arc">
            <Input.TextArea rows={2} maxLength={200} placeholder="如 从轻微不安走向安心入睡" />
          </Form.Item>
          <Form.Item label="教育目标（可输入多个）" name="educationalGoals">
            <Select mode="tags" placeholder="输入后回车添加，如 情绪放松" tokenSeparators={[',']} />
          </Form.Item>
          <Space size="large">
            <Form.Item label="排序" name="sortOrder">
              <InputNumber min={0} max={999} />
            </Form.Item>
            <Form.Item label="启用" name="enabled" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>
        </Form>
      </Modal>

      <Modal
        title="新建分类"
        open={catModal}
        onOk={handleNewCategory}
        onCancel={() => setCatModal(false)}
        destroyOnClose
      >
        <Form form={catForm} layout="vertical">
          <Form.Item label="分类 Key（唯一，英文）" name="key" rules={[{ required: true, message: '请输入分类 Key' }]}>
            <Input placeholder="如 emotion" maxLength={40} />
          </Form.Item>
          <Form.Item label="分类名称" name="name" rules={[{ required: true, message: '请输入分类名称' }]}>
            <Input placeholder="如 情绪与心理" maxLength={40} />
          </Form.Item>
          <Form.Item label="排序" name="sortOrder">
            <InputNumber min={0} max={999} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// ========================
// 场景 Tab
// ========================
function SceneTab({
  scenes,
  setScenes,
  loading,
}: {
  scenes: SceneItem[];
  setScenes: (updater: (prev: SceneItem[]) => SceneItem[]) => void;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SceneItem | null>(null);
  const [form] = Form.useForm<SceneItem>();

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ enabled: true, sortOrder: scenes.length + 1 });
    setOpen(true);
  };
  const openEdit = (s: SceneItem) => {
    setEditing(s);
    form.setFieldsValue(s);
    setOpen(true);
  };
  const handleOk = async () => {
    const v = await form.validateFields();
    if (editing) {
      setScenes(prev => prev.map(s => (s.key === editing.key ? { ...s, ...v } : s)));
    } else {
      if (scenes.some(s => s.key === v.key)) {
        message.error('场景 key（名称）已存在');
        return;
      }
      setScenes(prev => [...prev, v]);
    }
    setOpen(false);
  };
  const handleDelete = (key: string) => {
    setScenes(prev => prev.filter(s => s.key !== key));
  };
  const toggleEnabled = (key: string, val: boolean) => {
    setScenes(prev => prev.map(s => (s.key === key ? { ...s, enabled: val } : s)));
  };

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          新增场景
        </Button>
        <Typography.Text type="secondary">共 {scenes.length} 个场景</Typography.Text>
      </Space>
      <Table<SceneItem>
        rowKey="key"
        dataSource={[...scenes].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))}
        pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: [10, 20, 50] }}
        loading={loading}
        columns={[
          { title: '场景名(key)', dataIndex: 'key', width: 180 },
          { title: '环境设定', dataIndex: 'setting', ellipsis: true },
          { title: '细节元素', dataIndex: 'details', ellipsis: true },
          {
            title: '启用',
            dataIndex: 'enabled',
            width: 80,
            render: (e: any, r: SceneItem) => (
              <Switch checked={e !== false} onChange={val => toggleEnabled(r.key, val)} />
            ),
          },
          {
            title: '排序',
            dataIndex: 'sortOrder',
            width: 80,
            sorter: (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0),
          },
          {
            title: '操作',
            width: 140,
            render: (_: any, r: SceneItem) => (
              <Space>
                <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
                <Popconfirm title="确认删除该场景？" onConfirm={() => handleDelete(r.key)}>
                  <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
      <Modal
        title={editing ? '编辑场景' : '新增场景'}
        open={open}
        onOk={handleOk}
        onCancel={() => setOpen(false)}
        destroyOnClose
        width={640}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="场景名（key，唯一，作为展示名与后端检索键）" name="key" rules={[{ required: true, message: '请输入场景名' }]}>
            <Input disabled={!!editing} placeholder="如 静谧森林" maxLength={40} />
          </Form.Item>
          <Form.Item label="环境设定" name="setting">
            <Input.TextArea rows={2} maxLength={200} placeholder="如 安静的森林小径、柔软苔藓和会发光的树叶" />
          </Form.Item>
          <Form.Item label="细节元素" name="details">
            <Input.TextArea rows={2} maxLength={200} placeholder="如 萤火虫、弯月、蘑菇小屋" />
          </Form.Item>
          <Space size="large">
            <Form.Item label="排序" name="sortOrder">
              <InputNumber min={0} max={999} />
            </Form.Item>
            <Form.Item label="启用" name="enabled" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  );
}

// ========================
// 主页面
// ========================
export default function ThemeConfig() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [themes, setThemes] = useState<ThemeItem[]>([]);
  const [scenes, setScenes] = useState<SceneItem[]>([]);
  const [version, setVersion] = useState<number>(0);
  const [exists, setExists] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await callAdmin('theme-config/get');
      if (res.success) {
        setCategories(res.categories || []);
        setThemes(res.themes || []);
        setScenes(res.scenes || []);
        setVersion(res.version || 0);
        setExists(!!res.exists);
        if (!res.exists) message.info('配置文档尚未创建，可点击「初始化默认配置」生成完整主题库');
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

  // 整文档覆盖保存（前后端均从该文档读取，单一数据源）
  const save = async () => {
    setSaving(true);
    try {
      const res = await callAdmin('theme-config/save', {
        categories,
        themes,
        scenes,
        version,
      });
      if (res.success) {
        message.success('已保存主题配置（前后端即时生效）');
        setCategories(res.categories || categories);
        setThemes(res.themes || themes);
        setScenes(res.scenes || scenes);
        setVersion(res.version || version);
        setExists(true);
      } else {
        message.error(res.error || '保存失败');
      }
    } finally {
      setSaving(false);
    }
  };

  const seed = async () => {
    setSaving(true);
    try {
      const res = await callAdmin('theme-config/seed-default');
      if (res.success) {
        message.success(res.message || '已初始化默认配置');
        load();
      } else {
        message.error(res.error || '初始化失败');
      }
    } finally {
      setSaving(false);
    }
  };

  const items = [
    { key: 'themes', label: `主题管理 (${themes.length})`, children: <ThemeTab themes={themes} setThemes={setThemes} categories={categories} setCategories={setCategories} loading={loading} /> },
    { key: 'categories', label: `分类管理 (${categories.length})`, children: <CategoryTab categories={categories} setCategories={setCategories} loading={loading} /> },
    { key: 'scenes', label: `场景管理 (${scenes.length})`, children: <SceneTab scenes={scenes} setScenes={setScenes} loading={loading} /> },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }} wrap>
        <Typography.Title level={4} style={{ margin: 0 }}>
          主题配置（单一数据源）
        </Typography.Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
            刷新
          </Button>
          <Button icon={<DatabaseOutlined />} onClick={seed} loading={saving} disabled={exists}>
            初始化默认配置
          </Button>
          <Button type="primary" icon={<SaveOutlined />} onClick={save} loading={saving}>
            保存全部配置
          </Button>
        </Space>
      </Space>

      <Card>
        <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
          此处集中维护「主题 / 分类 / 场景」配置，保存后小程序端与故事生成后端将统一从该配置读取，无需改动代码。
          修改后点击「保存全部配置」整体生效；「初始化默认配置」仅在配置文档尚未创建时使用。
        </Typography.Paragraph>
        <Tabs items={items} />
      </Card>
    </div>
  );
}
