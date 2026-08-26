import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyOutlined,
  SaveOutlined,
  SettingOutlined,
  StarOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { callAdmin } from '../api';
import './SafetyConfig.css';

type Handling = 'intercept' | 'rewrite';

interface SafetyCategory {
  key: string;
  name: string;
  handling: Handling;
}

interface SensitiveWord {
  word: string;
  category: string;
}

interface AuditLog {
  id: string;
  timestamp?: string;
  type?: string;            // input_check | prompt_check | post_check（扫描来源）
  originalInput?: string;   // 原文
  processedInput?: string;  // 改写后文本（rewrite 时）
  actionTaken?: string;     // intercept | rewrite（处理动作）
  category?: string;        // 类别 key（如 violence）
  categoryName?: string;    // 类别中文名（如 暴力血腥）
  triggeredWord?: string;   // 命中敏感词
  status?: string;
  message?: string;
}

const DEFAULT_CATEGORIES: SafetyCategory[] = [
  { key: 'politics', name: '政治敏感', handling: 'intercept' },
  { key: 'violence', name: '暴力血腥', handling: 'rewrite' },
  { key: 'adult', name: '涉黄低俗', handling: 'intercept' },
  { key: 'abuse', name: '侮辱及不良引导', handling: 'rewrite' },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeCategories(value: unknown): SafetyCategory[] {
  if (!Array.isArray(value)) return DEFAULT_CATEGORIES;
  const normalized = value
    .map(item => {
      if (typeof item === 'string') {
        const key = item.trim();
        return key ? { key, name: key, handling: 'intercept' as Handling } : null;
      }
      if (!isRecord(item)) return null;
      const key = typeof item.key === 'string' ? item.key.trim() : '';
      const name = typeof item.name === 'string' ? item.name.trim() : key;
      const handling: Handling = item.handling === 'rewrite' ? 'rewrite' : 'intercept';
      return key && name ? { key, name, handling } : null;
    })
    .filter((item): item is SafetyCategory => item !== null);
  return normalized.length ? normalized : DEFAULT_CATEGORIES;
}

function normalizeWords(value: unknown, categories: SafetyCategory[]): SensitiveWord[] {
  if (!Array.isArray(value)) return [];
  const fallback = categories[0]?.key || 'abuse';
  return value
    .map(item => {
      if (typeof item === 'string') {
        const word = item.trim();
        return word ? { word, category: fallback } : null;
      }
      if (!isRecord(item)) return null;
      const word = typeof item.word === 'string' ? item.word.trim() : '';
      const categoryValue = typeof item.category === 'string' ? item.category : '';
      const category = categories.some(categoryItem => categoryItem.key === categoryValue)
        ? categoryValue
        : fallback;
      return word ? { word, category } : null;
    })
    .filter((item): item is SensitiveWord => item !== null);
}

function normalizeAuditLogs(value: unknown): AuditLog[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is AuditLog => isRecord(item) && typeof item.id === 'string');
}

function formatTime(value?: string) {
  if (!value) return '时间未知';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
}

function getAuditTypeLabel(type?: string) {
  switch (type) {
    case 'input_check': return '微信端家长输入';
    case 'prompt_check': return '大模型提示词二次审核';
    case 'post_check': return '生成内容复核';
    default: return '用户输入 / Prompt';
  }
}

function getActionTitle(actionTaken?: string) {
  return actionTaken === 'intercept' ? '直接拦截 / 高危阻断' : '友好改写 / 引导建议';
}

export default function SafetyConfig() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<SafetyCategory[]>(DEFAULT_CATEGORIES);
  const [words, setWords] = useState<SensitiveWord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [newWord, setNewWord] = useState('');
  const [newCategory, setNewCategory] = useState(DEFAULT_CATEGORIES[1].key);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryHandling, setNewCategoryHandling] = useState<Handling>('intercept');

  const categoryMap = useMemo(() => new Map(categories.map(item => [item.key, item])), [categories]);
  const pendingLogs = useMemo(() => auditLogs.filter(item => item.status === 'pending_review' || !item.status), [auditLogs]);

  const applyConfig = (raw: unknown) => {
    if (!isRecord(raw)) return;
    const nextCategories = normalizeCategories(raw.categories);
    setCategories(nextCategories);
    setWords(normalizeWords(raw.sensitiveWords, nextCategories));
    setAuditLogs(normalizeAuditLogs(raw.auditLogs));
    if (!nextCategories.some(item => item.key === newCategory)) setNewCategory(nextCategories[0]?.key || 'abuse');
  };

  const load = async () => {
    setLoading(true);
    const res = await callAdmin('safety-config/get');
    setLoading(false);
    if (res.success && res.config) applyConfig(res.config);
    else message.error(res.error || '加载安全配置失败');
  };

  useEffect(() => {
    void load();
  }, []);

  const onSave = async () => {
    setSaving(true);
    const res = await callAdmin('safety-config/update', { categories, sensitiveWords: words });
    setSaving(false);
    if (res.success) {
      message.success('安全配置已保存并应用到全栈');
      if (res.config) applyConfig(res.config);
      else await load();
    } else message.error(res.error || '保存失败');
  };

  const updateCategoryHandling = (key: string, handling: Handling) => {
    setCategories(current => current.map(item => item.key === key ? { ...item, handling } : item));
  };

  const addCategory = () => {
    const name = newCategoryName.trim();
    if (!name) {
      message.warning('请输入类别名称');
      return;
    }
    const key = `custom_${Date.now().toString(36)}`;
    if (categories.some(item => item.name === name)) {
      message.warning('该类别名称已存在');
      return;
    }
    setCategories(current => [...current, { key, name, handling: newCategoryHandling }]);
    setNewCategory(key); // 新增敏感词默认归入该类
    setNewCategoryName('');
    setNewCategoryHandling('intercept');
    setAddingCategory(false);
    message.success('已新增类别，记得点击「保存配置」同步到全栈');
  };

  const addWord = () => {
    const word = newWord.trim();
    if (!word) return;
    if (words.some(item => item.word === word)) {
      message.warning('这个词已经在词库中');
      return;
    }
    setWords(current => [...current, { word, category: newCategory }]);
    setNewWord('');
  };

  const removeWord = (word: string) => {
    setWords(current => current.filter(item => item.word !== word));
  };

  const onResolve = async (id: string, status: 'approved' | 'overridden') => {
    const res = await callAdmin('safety-config/audit-resolve', { id, status });
    if (res.success) {
      message.success(status === 'approved' ? '已确认处理' : '已驳回本次处理');
      await load();
    } else message.error(res.error || '复核失败');
  };

  return (
    <div className="safety-page">
      <div className="safety-hero">
        <div className="safety-hero__icon"><SafetyOutlined /></div>
        <div className="safety-hero__copy">
          <Typography.Title level={3}>全栈内容合规与少儿防沉迷安全防护中心</Typography.Title>
          <Typography.Text>自定义用户输入拦截、大模型提示词（Prompt）二次审核、多级有害内容写净化以及后台人工复核机制。</Typography.Text>
        </div>
        <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={onSave}>
          保存配置并实时应用到全栈
        </Button>
      </div>

      <div className="safety-layout">
        <div className="safety-main-column">
          <Card className="safety-panel" title={<span><SettingOutlined /> 1. 敏感词类别与差异化处理决策</span>} extra={<Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setAddingCategory(true)}>新增类别</Button>}>
            <div className="safety-category-list">
              {categories.map(category => (
                <div className="safety-category-row" key={category.key}>
                  <div>
                    <Typography.Text strong>{category.name}</Typography.Text>
                    <Typography.Text className="safety-code">Category Key: {category.key}</Typography.Text>
                  </div>
                  <div className="safety-category-control">
                    <Typography.Text type="secondary">处理策略：</Typography.Text>
                    <Select<Handling>
                      value={category.handling}
                      onChange={value => updateCategoryHandling(category.key, value)}
                      options={[
                        { value: 'intercept', label: '直接拦截（Intercept）' },
                        { value: 'rewrite', label: '儿童友好改写建议（Rewrite）' },
                      ]}
                    />
                  </div>
                </div>
              ))}
            </div>
            <Modal
              title="新增敏感词类别"
              open={addingCategory}
              onOk={addCategory}
              onCancel={() => setAddingCategory(false)}
              okText="新增"
              cancelText="取消"
              destroyOnClose
            >
              <Form layout="vertical">
                <Form.Item label="类别名称" required>
                  <Input
                    value={newCategoryName}
                    onChange={event => setNewCategoryName(event.target.value)}
                    placeholder="例如：赌博诈骗、迷信伪科学"
                    onPressEnter={addCategory}
                  />
                </Form.Item>
                <Form.Item label="默认处理策略">
                  <Select<Handling>
                    value={newCategoryHandling}
                    onChange={setNewCategoryHandling}
                    options={[
                      { value: 'intercept', label: '直接拦截（Intercept）' },
                      { value: 'rewrite', label: '儿童友好改写建议（Rewrite）' },
                    ]}
                  />
                </Form.Item>
              </Form>
            </Modal>
          </Card>

          <Card className="safety-panel" title={<span><PlusOutlined /> 2. 自定义敏感词添加与管理词库</span>}>
            <Form layout="inline" className="safety-add-form" onFinish={addWord}>
              <Form.Item className="safety-word-input">
                <Input
                  value={newWord}
                  onChange={event => setNewWord(event.target.value)}
                  placeholder="请输入禁用的敏感词（例如：暴力血腥）"
                  onPressEnter={addWord}
                />
              </Form.Item>
              <Form.Item>
                <Select value={newCategory} onChange={setNewCategory} options={categories.map(item => ({ value: item.key, label: item.name }))} />
              </Form.Item>
              <Form.Item>
                <Button type="primary" icon={<PlusOutlined />} onClick={addWord}>新增禁词</Button>
              </Form.Item>
            </Form>
            <div className="safety-library-heading">
              <Typography.Text type="secondary">当前拦截词汇库（{words.length} 个词）：</Typography.Text>
              <Tooltip title="保存后会同步给故事输入、Prompt 检查和生成结果复核流程">
                <InfoCircleOutlined />
              </Tooltip>
            </div>
            <div className="safety-word-cloud">
              {words.length ? words.map(item => (
                <Tag
                  key={`${item.category}-${item.word}`}
                  closable
                  onClose={() => removeWord(item.word)}
                  color={categoryMap.get(item.category)?.handling === 'intercept' ? 'red' : 'gold'}
                >
                  {item.word} <span className="safety-word-category">{categoryMap.get(item.category)?.name || item.category}</span>
                </Tag>
              )) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂未配置敏感词" />}
            </div>
          </Card>
        </div>

        <Card className="safety-panel safety-review-panel" title={<span><EyeOutlined /> 3. 伴梦安全守护：有害/违规内容拦截与复核流</span>}>
          <Alert
            className="safety-review-alert"
            type="warning"
            showIcon
            icon={<ClockCircleOutlined />}
            message={<span>待人工复核 <Badge count={pendingLogs.length} showZero /></span>}
            description="系统会保留原始内容和处理建议，管理员确认后才完成闭环。"
          />
          <div className="safety-review-list">
            {pendingLogs.length ? pendingLogs.map(log => {
              const category = categoryMap.get(log.category || '');
              const isIntercept = log.actionTaken === 'intercept';
              return (
                <Card size="small" className="safety-review-card" key={log.id}>
                  <div className="safety-review-card__header">
                    <div className="safety-review-card__title">
                      {isIntercept
                        ? <StopOutlined className="safety-review-icon safety-review-icon--intercept" />
                        : <StarOutlined className="safety-review-icon safety-review-icon--rewrite" />}
                      <Typography.Text strong>{getActionTitle(log.actionTaken)}</Typography.Text>
                      <Typography.Text className="safety-time">{formatTime(log.timestamp)}</Typography.Text>
                    </div>
                    <Tag color="orange">待人工复核</Tag>
                  </div>
                  <div className="safety-review-line"><Typography.Text type="secondary">扫描源：</Typography.Text>{getAuditTypeLabel(log.type)}</div>
                  <div className="safety-review-line"><Typography.Text type="secondary">违规类别：</Typography.Text><Tag color={category?.handling === 'intercept' ? 'red' : 'gold'}>{category?.name || log.categoryName || log.category || '未分类'}</Tag></div>
                  {log.triggeredWord ? (
                    <div className="safety-review-line"><Typography.Text type="secondary">触发词：</Typography.Text><Tag>{log.triggeredWord}</Tag></div>
                  ) : null}
                  <div className="safety-evidence">
                    <Typography.Text type="secondary">原始文：</Typography.Text>
                    <div>{log.originalInput || '暂无原始内容'}</div>
                  </div>
                  <div className="safety-evidence safety-evidence--processed">
                    <Typography.Text type="secondary">处理结果：</Typography.Text>
                    <div>{log.processedInput || '系统已拦截，无改写内容'}</div>
                  </div>
                  <div className="safety-review-actions">
                    <Button size="small" icon={<StopOutlined />} onClick={() => onResolve(log.id, 'overridden')}>驳回复原</Button>
                    <Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={() => onResolve(log.id, 'approved')}>复核核准</Button>
                  </div>
                </Card>
              );
            }) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无待复核记录" />}
          </div>
        </Card>
      </div>

      <div className="safety-footer-note">
        <InfoCircleOutlined /> <span>分类策略和词库保存后，会作用于故事输入、模型提示词和生成结果的二次安全检查。</span>
        <Button type="link" icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新配置</Button>
      </div>
    </div>
  );
}
