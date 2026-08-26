import { useEffect, useState, useCallback } from 'react';
import {
  Row, Col, Card, Statistic, Table, Button, Space, message,
  Typography, Tag, Tabs, Input, Form, Select, Switch, Divider,
  Tooltip, Badge, Popconfirm, Modal, Descriptions, Alert
} from 'antd';
import {
  ReloadOutlined, ThunderboltOutlined, EyeOutlined,
  CopyOutlined, SettingOutlined, ApiOutlined,
  CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined,
  RobotOutlined, PictureOutlined, AudioOutlined, SoundOutlined,
  DashboardOutlined, HistoryOutlined
} from '@ant-design/icons';
import { callAdmin } from '../api';

const { Title, Text, Paragraph } = Typography;

/* ---------- 类型 ---------- */

interface AiLog {
  _id?: string;
  service?: string;       // stepfun-text | stepfun-image | stepfun-tts | stepfun-clone
  type?: string;          // generateText | generateImage | synthesizeSpeech | cloneVoice
  route?: string;         // /api/story/generate-text 等
  method?: string;        // POST
  latencyMs?: number;
  tokens?: number;
  status?: number;        // HTTP 200 / 500
  success?: boolean;
  error?: string;
  createdAt?: string;
  [k: string]: any;
}

interface AiStats {
  totalRequests: number;
  byService: Record<string, { count: number; totalTokens: number; totalLatency: number; successCount: number; failCount: number }>;
  periodStart?: string;
}

interface AiConfig {
  apiKey?: string;          // 脱敏后
  apiKeySet?: boolean;
  model?: string;
  imageModel?: string;
  ttsModel?: string;
  cloneEnabled?: boolean;
  updatedAt?: string;
}

/* ---------- 常量 ---------- */

const SERVICE_MAP: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  'stepfun-text':    { label: 'StepFun 文本生成',   color: '#1677ff', icon: <RobotOutlined /> },
  'stepfun-image':   { label: 'StepFun 图片生成',   color: '#722ed1', icon: <PictureOutlined /> },
  'stepfun-tts':     { label: 'StepFun TTS 合成',   color: '#13c2c2', icon: <AudioOutlined /> },
  'stepfun-clone':   { label: '声音克隆提取',      color: '#fa8c16', icon: <SoundOutlined /> },
};

const SERVICE_KEYS = Object.keys(SERVICE_MAP);

/* ---------- 主组件 ---------- */

export default function AiConfig() {
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [stats, setStats] = useState<AiStats | null>(null);
  const [logs, setLogs] = useState<AiLog[]>([]);
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [logPagination, setLogPagination] = useState({ current: 1, pageSize: 15, total: 0 });
  const [activeService, setActiveService] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState<AiLog | null>(null);

  /* ---- 数据加载 ---- */

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    const res = await callAdmin('ai/stats');
    setStatsLoading(false);
    if (res.success) setStats(res.stats);
    else message.error(res.error || '加载统计失败');
  }, []);

  const loadLogs = useCallback(async (page = 1, pageSize = 15) => {
    setLoading(true);
    const res = await callAdmin('ai/logs', { page, pageSize, service: activeService !== 'all' ? activeService : undefined, status: statusFilter !== 'all' ? statusFilter : undefined });
    setLoading(false);
    if (res.success) {
      setLogs(res.logs || []);
      setLogPagination(prev => ({ ...prev, current: page, total: res.total || 0 }));
    } else message.error(res.error || '加载日志失败');
  }, [activeService, statusFilter]);

  const loadConfig = useCallback(async () => {
    setConfigLoading(true);
    const res = await callAdmin('ai/config/get');
    setConfigLoading(false);
    if (res.success) setConfig(res.config);
    else message.error(res.error || '加载配置失败');
  }, []);

  useEffect(() => { loadStats(); loadLogs(); loadConfig(); }, [loadStats, loadLogs, loadConfig]);

  /* ---- 配置保存 ---- */
  const [configForm] = Form.useForm();
  const handleSaveConfig = async () => {
    const vals = await configForm.validateFields().catch(() => null);
    if (!vals) return;
    // 如果新 key 不是纯掩码（***），才传给后端
    const payload: Record<string, any> = {};
    if (vals.apiKey && !vals.apiKey.includes('***')) payload.apiKey = vals.apiKey;
    if (vals.model) payload.model = vals.model;
    if (vals.imageModel) payload.imageModel = vals.imageModel;
    if (vals.ttsModel) payload.ttsModel = vals.ttsModel;
    if ('cloneEnabled' in vals) payload.cloneEnabled = vals.cloneEnabled;

    const res = await callAdmin('ai/config/update', payload);
    if (res.success) {
      message.success('AI 模型配置已更新');
      setConfigModalOpen(false);
      loadConfig();
    } else message.error(res.error || '保存失败');
  };

  /* ---- 统计卡片 ---- */
  const avgLatency = stats?.byService
    ? Object.values(stats.byService).reduce((s, v) => s + v.totalLatency, 0) /
      Math.max(1, Object.values(stats.byService).reduce((s, v) => s + v.count, 0))
    : 0;
  const totalTokens = stats?.byService
    ? Object.values(stats.byService).reduce((s, v) => s + v.totalTokens, 0)
    : 0;
  const totalSuccess = stats?.byService
    ? Object.values(stats.byService).reduce((s, v) => s + v.successCount, 0)
    : 0;
  const totalFail = stats?.byService
    ? Object.values(stats.byService).reduce((s, v) => s + v.failCount, 0)
    : 0;
  const successRate = (stats?.totalRequests ?? 0) > 0 ? ((totalSuccess / (stats?.totalRequests ?? 1)) * 100).toFixed(1) : '100.0';

  const latencyColor = avgLatency < 1000 ? '#52c41a' : avgLatency < 3000 ? '#faad14' : '#ff4d4f';
  const latencyLabel = avgLatency < 1000 ? 'EXCELLENT' : avgLatency < 3000 ? 'GOOD' : 'SLOW';

  /* ---- 表格列 ---- */
  const columns = [
    {
      title: '请求时间戳',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (v: string) => v ? new Date(v).toLocaleString('zh-CN', { hour12: false }) : '-',
    },
    {
      title: '接口动作',
      dataIndex: 'method',
      key: 'method',
      width: 80,
      render: (v: string) => v ? <Tag color="blue">{v}</Tag> : '-',
    },
    {
      title: '请求路由',
      dataIndex: 'route',
      key: 'route',
      width: 200,
      render: (v: string) => v || '-',
    },
    {
      title: '调用微服务',
      dataIndex: 'service',
      key: 'service',
      width: 180,
      render: (v: string) => {
        const info = SERVICE_MAP[v];
        return info ? (
          <Tag icon={info.icon} color={info.color}>{info.label}</Tag>
        ) : v || '-';
      },
    },
    {
      title: '响应延迟',
      dataIndex: 'latencyMs',
      key: 'latencyMs',
      width: 110,
      align: 'right' as const,
      render: (v: number) => v != null ? `${v} ms` : '-',
      sorter: (a: AiLog, b: AiLog) => (a.latencyMs || 0) - (b.latencyMs || 0),
    },
    {
      title: '字符/Token消耗',
      dataIndex: 'tokens',
      key: 'tokens',
      width: 120,
      align: 'right' as const,
      render: (v: number) => v != null ? `${v.toLocaleString()} Tks` : '-',
    },
    {
      title: '服务状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: number, r: AiLog) => {
        if ((v && v >= 200 && v < 300) || r.success === true) {
          return <Tag icon={<CheckCircleOutlined />} color="success">HTTP {v || 200}</Tag>;
        }
        return <Tag icon={<ExclamationCircleOutlined />} color="error">HTTP {v || 500}</Tag>;
      },
    },
    {
      title: '细节',
      key: 'detail',
      width: 70,
      render: (_: any, r: AiLog) => (
        <Button type="link" size="small" onClick={() => setDetailRecord(r)}>详情</Button>
      ),
    },
  ];

  /* ---- 筛选后的日志 ---- */
  const filteredLogs = logs;

  return (
    <div>
      {/* ====== 顶部标题区 ====== */}
      <Card
        style={{ marginBottom: 16, borderRadius: 12 }}
        bodyStyle={{ padding: '20px 24px' }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ fontSize: 28, lineHeight: 1, paddingTop: 2 }}><ApiOutlined /></div>
          <div style={{ flex: 1 }}>
            <Title level={4} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
              AI 模型配置与调用监控中心
              <Badge status={config?.apiKeySet ? 'success' : 'warning'} text={config?.apiKeySet ? '在线监听中' : '未配置密钥'} />
            </Title>
            <Paragraph type="secondary" style={{ margin: '4px 0 0', fontSize: 13 }}>
              实时监控本系统发起的 StepFun 文本生成、图片合成、语音克隆计算，以及 StepFun TTS 有声小说音频转码。
            </Paragraph>
          </div>
          <Space>
            <Button icon={<SettingOutlined />} onClick={() => { configForm.setFieldsValue(config); setConfigModalOpen(true); }} loading={configLoading}>
              模型配置
            </Button>
            <Button type="primary" icon={<ReloadOutlined />} onClick={() => { loadStats(); loadLogs(); }} loading={statsLoading}>
              立即拉取最新调用记录
            </Button>
          </Space>
        </div>
      </Card>

      {/* ====== 快捷模拟按钮组（深色） ====== */}
      <Card
        style={{ marginBottom: 16, borderRadius: 12, background: '#1f1f1f' }}
        bodyStyle={{ padding: '20px 24px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <Text strong style={{ color: '#fff' }}>沙箱接口仿真器（Simulate Live Network Traffic）</Text>
          <Text type="secondary" style={{ fontSize: 12, color: '#888' }}>点击下列按钮，立即模拟一次真实用户的服务端接口交互与算法调用</Text>
        </div>
        <Space wrap>
          {[
            { key: 'text', label: '模拟 StepFun 文本生成', color: '#1677ff', icon: <RobotOutlined /> },
            { key: 'image', label: '模拟 StepFun 图片生成', color: '#722ed1', icon: <PictureOutlined /> },
            { key: 'tts', label: '模拟 StepFun TTS 转码', color: '#13c2c2', icon: <AudioOutlined /> },
            { key: 'clone', label: '模拟 录音克隆算力提取', color: '#fa8c16', icon: <SoundOutlined /> },
          ].map(btn => (
            <Button
              key={btn.key}
              icon={btn.icon}
              style={{ background: btn.color, borderColor: btn.color, color: '#fff', borderRadius: 20 }}
              onClick={async () => {
                const res = await callAdmin('simulate-api-call', { type: btn.key });
                if (res.success) { message.success('已写入模拟调用数据'); loadStats(); loadLogs(); }
                else message.error(res.error || '模拟失败');
              }}
            >
              {btn.label}
            </Button>
          ))}
        </Space>
      </Card>

      {/* ====== 统计卡片行 ====== */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card>
            <Statistic title="TOTAL REQUESTS" value={stats?.totalRequests || 0} suffix="次" />
            <Divider style={{ margin: '8px 0' }} />
            <Text type="secondary" style={{ fontSize: 12 }}>活跃统计期：近30日</Text>
          </Card>
        </Col>
        {SERVICE_KEYS.map(key => {
          const svc = stats?.byService?.[key];
          const info = SERVICE_MAP[key];
          return (
            <Col key={key} xs={24} sm={12} md={8} lg={4}>
              <Card>
                <Statistic
                  title={(<span>{info.label.toUpperCase().replace('STEPFUN ', '')} CALLS</span>)}
                  value={svc?.count || 0}
                  suffix="次"
                  valueStyle={{ color: info.color }}
                />
                <Divider style={{ margin: '8px 0' }} />
                <Row>
                  <Col span={12}><Text type="secondary" style={{ fontSize: 11 }}>成功率：</Text><Text style={{ fontSize: 12 }}>{svc?.count ? ((svc.successCount / svc.count) * 100).toFixed(0) : 100}%</Text></Col>
                  <Col span={12}><Text type="secondary" style={{ fontSize: 11 }}>Token 消耗：</Text><Text style={{ fontSize: 12 }}>{(svc?.totalTokens || 0).toLocaleString()}</Text></Col>
                </Row>
              </Card>
            </Col>
          );
        })}
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card>
            <Statistic title="TOTAL TOKEN COUNT" value={totalTokens} suffix="Tokens" />
            <Divider style={{ margin: '8px 0' }} />
            <Row>
              <Col span={12}><Text type="secondary" style={{ fontSize: 11 }}>拟合字符：</Text><Text style={{ fontSize: 12 }}>{Math.round(totalTokens * 3.5).toLocaleString()} 字</Text></Col>
              <Col span={12}><Text type="secondary" style={{ fontSize: 11 }}>平均耗量/部</Text><Text style={{ fontSize: 12 }}>—</Text></Col>
            </Row>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card>
            <Statistic
              title="AVERAGE LATENCY"
              value={Math.round(avgLatency)}
              suffix="ms"
              valueStyle={{ color: latencyColor }}
            />
            <Divider style={{ margin: '8px 0' }} />
            <Tag color={latencyColor === '#52c41a' ? 'green' : latencyColor === '#faad14' ? 'orange' : 'red'} style={{ marginLeft: 0 }}>
              {latencyLabel}
            </Tag>
            <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>问效机房</Text>
          </Card>
        </Col>
      </Row>

      {/* ====== 日志表格 ====== */}
      <Card
        title={
          <Space>
            <DashboardOutlined />
            <span>网关流水监控台（Gate Logs Console）</span>
          </Space>
        }
        style={{ borderRadius: 12 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <Tabs
            activeKey={activeService}
            onChange={(k) => { setActiveService(k); loadLogs(1); }}
            size="small"
            items={[
              { key: 'all', label: '全部服务' },
              ...SERVICE_KEYS.map(k => ({ key: k, label: SERVICE_MAP[k].label.replace('StepFun ', '') })),
            ]}
          />
          <Space>
            <Text type="secondary" style={{ fontSize: 12 }}>状态过滤：</Text>
            <Select
              value={statusFilter}
              onChange={(v) => { setStatusFilter(v); loadLogs(1); }}
              size="small"
              style={{ width: 100 }}
              options={[
                { value: 'all', label: '全部' },
                { value: 'success', label: `成功 (${totalSuccess})` },
                { value: 'fail', label: `失败 (${totalFail})` },
              ]}
            />
          </Space>
        </div>

        <Table
          rowKey={(r: AiLog) => r._id || Math.random().toString()}
          dataSource={filteredLogs}
          columns={columns}
          loading={loading}
          pagination={{
            ...logPagination,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条记录`,
            onChange: (p, ps) => loadLogs(p, ps),
          }}
          size="middle"
          scroll={{ x: 900 }}
        />
      </Card>

      {/* ====== 配置弹窗 ====== */}
      <Modal
        title="AI 模型配置"
        open={configModalOpen}
        onOk={handleSaveConfig}
        onCancel={() => setConfigModalOpen(false)}
        width={560}
        destroyOnClose
      >
        <Alert
          type="info"
          showIcon
          message="API Key 存储在云函数环境变量中，不会暴露到前端。留空表示不修改当前值。"
          style={{ marginBottom: 16 }}
        />
        <Form form={configForm} layout="vertical" initialValues={config || undefined}>
          <Form.Item name="apiKey" label="StepFun API Key">
            <Input.Password placeholder="sk-... （输入新 Key 或留空不修改）" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="model" label="文本模型">
                <Select
                  options={[
                    { value: 'step-3.7-flash', label: 'step-3.7-flash（推荐）' },
                    { value: 'step-1.5-flash', label: 'step-1.5-flash' },
                    { value: 'step-1.8k-flash', label: 'step-1.8k-flash' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="imageModel" label="图片模型">
                <Select
                  options={[
                    { value: 'step-image-edit-2', label: 'step-image-edit-2（推荐）' },
                    { value: 'step-image-edit-1', label: 'step-image-edit-1' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="ttsModel" label="TTS 语音模型">
                <Select
                  options={[
                    { value: 'stepaudio-2.5-tts', label: 'stepaudio-2.5-tts（推荐）' },
                    { value: 'stepaudio-1.5-tts', label: 'stepaudio-1.5-tts' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="cloneEnabled" label="声音克隆" valuePropName="checked">
                <Switch checkedChildren="启用" unCheckedChildren="禁用" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
        {config?.updatedAt && (
          <Text type="secondary" style={{ fontSize: 12 }}>上次更新：{new Date(config.updatedAt).toLocaleString('zh-CN')}</Text>
        )}
      </Modal>

      {/* ====== 详情抽屉/弹窗 ====== */}
      <Modal
        title="调用详情"
        open={!!detailRecord}
        onCancel={() => setDetailRecord(null)}
        footer={null}
        width={600}
      >
        {detailRecord && (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="时间">{new Date(detailRecord.createdAt || '').toLocaleString('zh-CN')}</Descriptions.Item>
            <Descriptions.Item label="服务">{SERVICE_MAP[detailRecord.service || '']?.label || detailRecord.service}</Descriptions.Item>
            <Descriptions.Item label="路由">{detailRecord.route}</Descriptions.Item>
            <Descriptions.Item label="方法">{detailRecord.method}</Descriptions.Item>
            <Descriptions.Item label="延迟">{detailRecord.latencyMs} ms</Descriptions.Item>
            <Descriptions.Item label="Token">{detailRecord.tokens || '-'}</Descriptions.Item>
            <Descriptions.Item label="状态" span={2}>
              {(detailRecord.status ?? 0) >= 200 && (detailRecord.status ?? 0) < 300
                ? <Tag color="success">成功</Tag>
                : <Tag color="error">失败 {detailRecord.error || ''}</Tag>}
            </Descriptions.Item>
            {detailRecord.error && (
              <Descriptions.Item label="错误信息" span={2}>{detailRecord.error}</Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}
