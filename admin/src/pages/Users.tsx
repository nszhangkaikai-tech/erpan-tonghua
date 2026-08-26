import { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Input,
  Button,
  Space,
  message,
  Tag,
  Typography,
  Modal,
  Form,
  InputNumber,
  Select,
  Popconfirm,
} from 'antd';
import { SearchOutlined, ReloadOutlined, EditOutlined } from '@ant-design/icons';
import { callAdmin } from '../api';
import type { UserDoc } from '../types';

// 后台可编辑的宝宝成长档案字段（与 mp-user.updateProfile 的 PROFILE_FIELDS 对齐）
const PROFILE_FIELDS = [
  'childName',
  'gender',
  'age',
  'birthday',
  'heightCm',
  'weightKg',
  'traits',
  'favoriteTheme',
  'favoriteScene',
  'growthNotes',
  'parentName',
  'bedTime',
] as const;

export default function Users() {
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<UserDoc[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [keywordInput, setKeywordInput] = useState('');

  // 编辑宝宝资料弹窗状态
  const [editOpen, setEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserDoc | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileForm] = Form.useForm<Record<string, any>>();

  const load = useCallback(
    async (p = page, kw = keyword) => {
      setLoading(true);
      const res = await callAdmin('users/list', { page: p, pageSize: 20, keyword: kw || undefined });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSearch = () => {
    setKeyword(keywordInput);
    setPage(1);
    load(1, keywordInput);
  };

  // ---------- 编辑宝宝资料 ----------
  const openEditProfile = (r: UserDoc) => {
    setEditingUser(r);
    const p = r.profile || {};
    profileForm.resetFields();
    profileForm.setFieldsValue({
      childName: p.childName ?? '',
      gender: p.gender ?? undefined,
      age: p.age ?? undefined,
      birthday: p.birthday ?? '',
      heightCm: p.heightCm ?? undefined,
      weightKg: p.weightKg ?? undefined,
      traits: p.traits ?? '',
      favoriteTheme: p.favoriteTheme ?? '',
      favoriteScene: p.favoriteScene ?? '',
      growthNotes: p.growthNotes ?? '',
      parentName: p.parentName ?? '',
      bedTime: p.bedTime ?? '',
    });
    setEditOpen(true);
  };

  const handleSaveProfile = async () => {
    const v = await profileForm.validateFields();
    const profile: Record<string, any> = {};
    PROFILE_FIELDS.forEach((f) => {
      const val = v[f];
      if (val === undefined || val === null || val === '') return;
      profile[f] =
        f === 'age' || f === 'heightCm' || f === 'weightKg' ? Number(val) : val;
    });
    setSavingProfile(true);
    try {
      const res = await callAdmin('users/profile-update', {
        openid: editingUser?._id,
        profile,
      });
      if (res.success) {
        message.success('宝宝成长资料已更新');
        setEditOpen(false);
        load(page, keyword);
      } else {
        message.error(res.error || '保存失败');
      }
    } finally {
      setSavingProfile(false);
    }
  };

  const columns = [
    {
      title: 'OpenID',
      dataIndex: '_id',
      key: '_id',
      ellipsis: true,
      render: (v: string) => v || '-',
    },
    {
      title: '昵称',
      dataIndex: 'nickname',
      key: 'nickname',
      render: (v: string) => v || <Typography.Text type="secondary">未设置</Typography.Text>,
    },
    {
      title: '头像',
      dataIndex: 'avatar',
      key: 'avatar',
      render: (v: string) =>
        v ? <img src={v} alt="avatar" style={{ width: 36, height: 36, borderRadius: '50%' }} /> : '-',
    },
    {
      title: '孩子数',
      key: 'children',
      render: (_: any, r: UserDoc) => r.children?.length ?? 0,
    },
    {
      title: '宝宝称呼',
      key: 'childName',
      render: (_: any, r: UserDoc) =>
        r.profile?.childName || <Typography.Text type="secondary">未填写</Typography.Text>,
    },
    {
      title: '额度',
      key: 'quota',
      render: (_: any, r: UserDoc) =>
        r.quota ? (
          <Tag color="blue">
            {r.quota.used ?? 0}/{r.quota.total ?? 0}
          </Tag>
        ) : (
          '-'
        ),
    },
    {
      title: '注册时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => (v ? new Date(v).toLocaleString() : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_: any, r: UserDoc) => (
        <Button size="small" icon={<EditOutlined />} onClick={() => openEditProfile(r)}>
          编辑宝宝资料
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          用户管理
        </Typography.Title>
        <Space>
          <Input
            placeholder="搜索 OpenID / 昵称"
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

      <Modal
        title={`编辑宝宝资料${editingUser?.nickname ? ` · ${editingUser.nickname}` : ''}`}
        open={editOpen}
        onOk={handleSaveProfile}
        onCancel={() => setEditOpen(false)}
        confirmLoading={savingProfile}
        destroyOnClose
        width={560}
      >
        <Form form={profileForm} layout="vertical">
          <Typography.Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 12 }}>
            以下信息将与小程序端宝宝档案合并保存（仅覆盖此处填写的字段，未填写项保持不变）。
          </Typography.Paragraph>
          <Space size="large" style={{ display: 'flex', flexWrap: 'wrap' }}>
            <Form.Item label="宝宝称呼" name="childName" style={{ width: 220 }}>
              <Input placeholder="如 小宝" maxLength={20} />
            </Form.Item>
            <Form.Item label="性别" name="gender" style={{ width: 140 }}>
              <Select
                placeholder="选择"
                allowClear
                options={[
                  { value: 'male', label: '男' },
                  { value: 'female', label: '女' },
                  { value: 'unknown', label: '未知' },
                ]}
              />
            </Form.Item>
            <Form.Item label="年龄（岁）" name="age" style={{ width: 140 }}>
              <InputNumber min={0} max={18} style={{ width: '100%' }} />
            </Form.Item>
          </Space>
          <Space size="large" style={{ display: 'flex', flexWrap: 'wrap' }}>
            <Form.Item label="生日" name="birthday" style={{ width: 220 }}>
              <Input placeholder="如 2022-06-01" maxLength={20} />
            </Form.Item>
            <Form.Item label="身高（cm）" name="heightCm" style={{ width: 140 }}>
              <InputNumber min={0} max={250} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="体重（kg）" name="weightKg" style={{ width: 140 }}>
              <InputNumber min={0} max={200} step={0.1} style={{ width: '100%' }} />
            </Form.Item>
          </Space>
          <Form.Item label="性格特点" name="traits">
            <Input placeholder="如 活泼、好奇、怕黑" maxLength={100} />
          </Form.Item>
          <Space size="large" style={{ display: 'flex', flexWrap: 'wrap' }}>
            <Form.Item label="喜欢的主题" name="favoriteTheme" style={{ width: 220 }}>
              <Input placeholder="如 恐龙、太空" maxLength={40} />
            </Form.Item>
            <Form.Item label="喜欢的场景" name="favoriteScene" style={{ width: 220 }}>
              <Input placeholder="如 森林、海底" maxLength={40} />
            </Form.Item>
          </Space>
          <Form.Item label="家长称呼" name="parentName">
            <Input placeholder="如 妈妈" maxLength={20} />
          </Form.Item>
          <Form.Item label="入睡时间" name="bedTime">
            <Input placeholder="如 21:00" maxLength={10} />
          </Form.Item>
          <Form.Item label="成长备注" name="growthNotes">
            <Input.TextArea rows={3} maxLength={500} placeholder="记录宝宝近期的成长变化、趣事或特别需求" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
