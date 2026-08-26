import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Card,
  Row,
  Col,
  Button,
  Space,
  message,
  Tag,
  Typography,
  Input,
  Popconfirm,
  Pagination,
} from 'antd';
import {
  ReloadOutlined,
  PlusOutlined,
  DeleteOutlined,
  StarOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { callAdmin } from '../api';
import type { TemplateDoc } from '../types';

export default function Templates() {
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<TemplateDoc[]>([]);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const navigate = useNavigate();
  const location = useLocation();

  const load = async () => {
    setLoading(true);
    try {
      const res = await callAdmin('templates/list');
      if (res.success) setList(res.list || []);
      else message.error(res.error || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [location.pathname]);

  const onDelete = async (id: string) => {
    const res = await callAdmin('template/delete', { id });
    if (res.success) {
      message.success('已删除');
      load();
    } else message.error(res.error || '删除失败');
  };

  const onToggle = async (id: string) => {
    const res = await callAdmin('template/toggle-recommend', { id });
    if (res.success) {
      message.success('已更新推荐状态');
      load();
    } else message.error(res.error || '操作失败');
  };

  const filtered = list.filter(tpl => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return true;
    return (
      (tpl.name || '').toLowerCase().includes(keyword) ||
      (tpl.theme || '').toLowerCase().includes(keyword) ||
      (tpl.educationalGoal || '').toLowerCase().includes(keyword) ||
      (tpl.scene || '').toLowerCase().includes(keyword) ||
      (tpl.description || '').toLowerCase().includes(keyword)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const pageItems = filtered.slice(startIndex, startIndex + pageSize);

  // 搜索变化时回到第一页
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          模板管理
        </Typography.Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/templates/create')}>
            新增模板
          </Button>
        </Space>
      </Space>

      <Space style={{ marginBottom: 16, width: '100%' }} size="middle">
        <Input
          placeholder="搜索模板名称/主题/教育目标/场景..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          allowClear
          style={{ maxWidth: 420 }}
        />
      </Space>

      <SpinWrapper loading={loading}>
        {pageItems.length === 0 ? (
          <Typography.Text type="secondary">没有找到匹配的绘本模板</Typography.Text>
        ) : (
          <Row gutter={[16, 16]}>
            {pageItems.map(tpl => {
              const key = (tpl._id || tpl.id) as string;
              const mc = (tpl.mainCharacter || {}) as any;
              const isRec = !!tpl.isRecommended;
              return (
                <Col key={key} xs={24} sm={12} lg={8} xxl={6}>
                  <Card
                    hoverable
                    loading={false}
                    cover={
                      <img
                        alt={tpl.name || '封面'}
                        src={tpl.cover || 'https://images.unsplash.com/photo-1519052537078-e6302a4968d4?w=500&q=80'}
                        style={{ height: 200, objectFit: 'cover' }}
                      />
                    }
                    actions={[
                      <span key="edit" onClick={() => key && navigate(`/templates/edit/${key}`)}>
                        <EditOutlined /> 编辑
                      </span>,
                      <span key="rec" onClick={() => key && onToggle(key)}>
                        <StarOutlined /> {isRec ? '取消推荐' : '设为推荐'}
                      </span>,
                      <Popconfirm
                        key="del"
                        title="确认删除该模板？"
                        onConfirm={() => key && onDelete(key)}
                      >
                        <span>
                          <DeleteOutlined /> 删除
                        </span>
                      </Popconfirm>,
                    ]}
                  >
                    <Space direction="vertical" size={6} style={{ width: '100%' }}>
                      <Space wrap align="center">
                        <Typography.Text strong style={{ fontSize: 15 }}>
                          {tpl.name || '未命名'}
                        </Typography.Text>
                        <Tag color={isRec ? 'gold' : 'default'}>{isRec ? '推荐' : '普通'}</Tag>
                      </Space>

                      <Space size={4} wrap>
                        {tpl.ageGroup && <Tag>{tpl.ageGroup}</Tag>}
                        {tpl.theme && <Tag color="orange">{tpl.theme}</Tag>}
                      </Space>

                      <Typography.Paragraph
                        type="secondary"
                        ellipsis={{ rows: 2 }}
                        style={{ margin: 0, fontSize: 13 }}
                      >
                        {tpl.description || '暂无描述'}
                      </Typography.Paragraph>

                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        教育目标：{tpl.educationalGoal || '-'} · 场景：{tpl.scene || '-'}
                      </Typography.Text>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        主角：{mc.name || '奇奇'}
                        {mc.role ? `（${mc.role}）` : ''}
                      </Typography.Text>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        使用次数：{tpl.useCount ?? 0}
                      </Typography.Text>
                    </Space>
                  </Card>
                </Col>
              );
            })}
          </Row>
        )}
      </SpinWrapper>

      {filtered.length > pageSize && (
        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <Pagination
            current={currentPage}
            pageSize={pageSize}
            total={filtered.length}
            showSizeChanger
            pageSizeOptions={[12, 24, 48]}
            showTotal={(total, range) => `第 ${range[0]}-${range[1]} 条 / 共 ${total} 条`}
            onChange={(page, size) => {
              setCurrentPage(page);
              if (size !== pageSize) setPageSize(size);
            }}
          />
        </div>
      )}
    </div>
  );
}

// 轻量 loading 包裹：避免 antd Spin 需额外 import 的麻烦
function SpinWrapper({ loading, children }: { loading: boolean; children: ReactNode }) {
  if (loading) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center', color: '#999' }}>加载中...</div>
    );
  }
  return <>{children}</>;
}
