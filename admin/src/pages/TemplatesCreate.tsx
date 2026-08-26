import { useEffect, useState } from 'react';
import {
  Form,
  Input,
  Select,
  Button,
  Space,
  message,
  Typography,
  Card,
  Row,
  Col,
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { callAdmin } from '../api';
import type { TemplateDoc } from '../types';

const { TextArea } = Input;
const { Title } = Typography;

export default function TemplatesCreate() {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingPrompt, setGeneratingPrompt] = useState(false);

  // 基于已有字段自动生成 AI 故事底稿 Prompt
  const handleGenerateAiPrompt = async () => {
    try {
      const values = await form.validateFields(['name', 'ageGroup', 'theme', 'educationalGoal', 'scene', 'mainCharacterName', 'mainCharacterRole', 'mainCharacterPersonality']);
      setGeneratingPrompt(true);
      const prompt = buildAiPrompt(values);
      form.setFieldsValue({ aiPrompt: prompt });
      message.success('已根据当前信息生成提示词，可继续编辑');
    } catch (e) {
      // 部分字段未填时仍尽量生成
      const values = form.getFieldsValue();
      const prompt = buildAiPrompt(values);
      form.setFieldsValue({ aiPrompt: prompt });
      message.success('已生成提示词，建议补全核心字段以获得更精准结果');
    } finally {
      setGeneratingPrompt(false);
    }
  };

  // Prompt 生成规则：基于已有表单字段拼接可复用的故事底稿提示词
  const buildAiPrompt = (values: Record<string, any>) => {
    const name = values.name || ' unspecified ';
    const ageGroup = values.ageGroup || ' unspecified ';
    const theme = values.theme || ' unspecified ';
    const goal = values.educationalGoal || ' unspecified ';
    const scene = values.scene || ' unspecified ';
    const charName = values.mainCharacterName || ' unspecified ';
    const charRole = values.mainCharacterRole || ' unspecified ';
    const charPersonality = values.mainCharacterPersonality || ' unspecified ';

    return [
      `你是一位拥有丰富经验的儿童插画绘本故事大师。`,
      `请围绕主角「${charName}」（${charRole}）创作一篇适合${ageGroup}儿童的绘本故事。`,
      `性格特质：${charPersonality}。`,
      `故事场景：${scene}。`,
      `为了达成「${goal}」的教育习惯培养目标，请以「${theme}」为主题构建故事情节。`,
      `请创作一篇适合作为绘本的${name}故事，要求：`,
      `1. 故事充满温暖与想象力，包含生动的对话，并给配音人提供极具情感的表达空间。`,
      `2. 目标：${goal}。`,
      `3. 场景：${scene}。`,
      `4. 主题：${theme}。`,
      `5. 主角：${charName}（${charRole}），性格：${charPersonality}。`,
      `6. 适合年龄：${ageGroup}。`,
      `请输出完整故事文本，分页清晰，便于后续分镜与插图生成。`
    ].join('\n');
  };

  useEffect(() => {
    if (isEdit && id) {
      setLoading(true);
      callAdmin('template/get', { id })
        .then(res => {
          if (res.success && res.template) {
            const tpl = res.template;
            form.setFieldsValue({
              name: tpl.name,
              ageGroup: tpl.ageGroup || '3-6岁',
              theme: tpl.theme || '睡前安抚',
              educationalGoal: tpl.educationalGoal || '勇敢自信',
              scene: tpl.scene || '神秘城堡',
              description: tpl.description || '',
              mainCharacterName: tpl.mainCharacter?.name || '',
              mainCharacterRole: tpl.mainCharacter?.role || '',
              mainCharacterPersonality: tpl.mainCharacter?.personality || '',
              aiPrompt: tpl.aiPrompt || '',
              cover: tpl.cover || '',
            });
          } else {
            message.error(res.error || '模板不存在');
            navigate('/templates');
          }
        })
        .finally(() => setLoading(false));
    }
  }, [id, isEdit, form, navigate]);

  const onSubmit = async (values: Record<string, any>) => {
    setSaving(true);
    try {
      const payload = {
        name: values.name,
        ageGroup: values.ageGroup,
        theme: values.theme,
        educationalGoal: values.educationalGoal,
        scene: values.scene,
        description: values.description || '',
        mainCharacter: {
          name: values.mainCharacterName,
          role: values.mainCharacterRole,
          personality: values.mainCharacterPersonality,
        },
        aiPrompt: values.aiPrompt || '',
        cover: values.cover || '',
      };

      const action = isEdit ? 'template/update' : 'template/add';
      const res = await callAdmin(action, isEdit ? { id, ...payload } : payload);
      if (res.success) {
        message.success(isEdit ? '模板已更新' : '模板已创建');
        navigate('/templates');
      } else {
        message.error(res.error || (isEdit ? '更新失败' : '创建失败'));
      }
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '保存失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: 980, margin: '0 auto' }}>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/templates')}>
          返回模板列表
        </Button>
        <Title level={4} style={{ margin: 0 }}>
          {isEdit ? '编辑儿童绘本情境模板' : '新建并发布儿童绘本情境模板'}
        </Title>
      </Space>

      <Card loading={loading}>
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            ageGroup: '3-6岁',
            theme: '睡前安抚',
            educationalGoal: '勇敢自信',
            scene: '神秘城堡',
          }}
          onFinish={onSubmit}
        >
          <Title level={5}>1. 核心大纲信息</Title>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="name"
                label="模板标题（故事大名）"
                rules={[{ required: true, message: '请输入模板标题' }]}
              >
                <Input placeholder="如：不爱整理的呼啦熊" maxLength={60} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="ageGroup" label="适听年龄" rules={[{ required: true }]}>
                <Select
                  options={[
                    { value: '0-3岁', label: '0-3岁（婴幼儿）' },
                    { value: '3-6岁', label: '3-6岁（学前）' },
                    { value: '6-9岁', label: '6-9岁（小学低年级）' },
                    { value: '9-12岁', label: '9-12岁（小学中高年级）' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="theme" label="故事分类主题" rules={[{ required: true }]}>
                <Input placeholder="如：睡前安抚" />
              </Form.Item>
            </Col>
          </Row>

          <Title level={5} style={{ marginTop: 24 }}>2. 习惯与场景设定</Title>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="educationalGoal" label="教育习惯培养目标" rules={[{ required: true }]}>
                <Input placeholder="如：克服恐惧" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="scene" label="默认故事场景" rules={[{ required: true }]}>
                <Input placeholder="如：静谧森林" />
              </Form.Item>
            </Col>
          </Row>

          <Title level={5} style={{ marginTop: 24 }}>3. 默认主人公设定</Title>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="mainCharacterName" label="主角名字">
                <Input placeholder="如：呼呼" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="mainCharacterRole" label="角色身份/物种">
                <Input placeholder="如：小熊玩偶、独角兽" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="mainCharacterPersonality" label="人设性格特征">
                <Input placeholder="如：善良懂事，但偶尔会不听话" />
              </Form.Item>
            </Col>
          </Row>

          <Title level={5} style={{ marginTop: 24 }}>4. 模板前台展示说明</Title>
          <Form.Item name="description" label="模板简要说明（吸引家长点击使用）">
            <TextArea rows={3} placeholder="输入一段吸引家长使用的简介，简述故事主旨与教育启发..." maxLength={200} showCount />
          </Form.Item>

          <Title level={5} style={{ marginTop: 24 }}>5. 大模型 AI 提示词工程（Prompt）维护</Title>
          <Space style={{ marginBottom: 12 }}>
            <Button
              size="small"
              onClick={handleGenerateAiPrompt}
              loading={generatingPrompt}
            >
              智能生成模板提示词
            </Button>
          </Space>
          <Form.Item name="aiPrompt" label="AI 故事底稿 Prompt 核心词">
            <TextArea rows={5} placeholder="你是一位拥有丰富经验的儿童插画绘本大师。请围绕主角呼呼（小熊），性格特质：好动懂事，在静谧森林场景中..." />
          </Form.Item>

          <Title level={5} style={{ marginTop: 24 }}>6. AI 封面图自动生成</Title>
          <Form.Item name="cover" label="封面图 URL（留空则由 AI 按模板特征自动生成）">
            <Input placeholder="https://..." />
          </Form.Item>
          <CoverPreview form={form} />

          <Form.Item style={{ marginTop: 32 }}>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving} size="large">
              {isEdit ? '保存修改' : '立即生成封面并发布上架'}
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}

// 封面预览：实时反映 cover 字段。留空时提示将由 AI 按「年龄+主题+目标+场景」自动生成
function CoverPreview({ form }: { form: any }) {
  const cover = Form.useWatch('cover', form);
  if (!cover) {
    return (
      <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 0 }}>
        保存后将由 AI 自动生成封面：按「年龄 + 主题 + 目标 + 场景」拼装提示词调用画图模型；
        相同特征的模板会命中 story_covers 缓存复用同一张图（省时且风格统一）。
      </Typography.Paragraph>
    );
  }
  return (
    <img
      src={cover}
      alt="封面预览"
      style={{ width: 200, height: 200, objectFit: 'cover', borderRadius: 8, border: '1px solid #f0f0f0' }}
    />
  );
}
