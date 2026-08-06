import { Capacitor, CapacitorHttp } from '@capacitor/core';
import type { ApiSettings, ChatMessage } from './types';

export type TestResult = { ok: boolean; detail: string };

type ApiMessage = { role: 'system' | 'user' | 'assistant'; content: string };

async function rawPost(settings: ApiSettings, messages: ApiMessage[]): Promise<{ status: number; data: unknown }> {
  const body = { model: settings.model, messages, temperature: 0.7 };
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.apiKey}` };
  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.post({
      url: settings.endpoint,
      headers,
      data: body,
      responseType: 'json',
      connectTimeout: 30000,
      readTimeout: 120000,
    });
    return { status: res.status, data: res.data };
  }
  const response = await fetch(settings.endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

export async function postChatCompletion(settings: ApiSettings, messages: ChatMessage[], pantry: string[], recipeContext: string): Promise<string> {
  const { status, data } = await rawPost(settings, [
    {
      role: 'system',
      content: `你是一名严谨、专业且有创造力的调酒师。使用中文回答，优先给出精确 ml 数量、杯型、技法和步骤。涉及生蛋清时提示风险，不鼓励过量饮酒。用户酒柜：${pantry.join('、') || '未记录'}。本地配方参考：\n${recipeContext}`,
    },
    ...messages,
  ]);
  if (status < 200 || status >= 300) throw new Error(`接口返回 ${status}`);
  const answer = (data as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content;
  if (!answer) throw new Error('接口未返回有效内容');
  return answer;
}

export async function testConnection(settings: ApiSettings): Promise<TestResult> {
  if (!settings.endpoint.trim() || !settings.apiKey.trim()) {
    return { ok: false, detail: '请先填写接口地址与 API 密钥' };
  }
  try {
    const { status, data } = await rawPost(settings, [{ role: 'user', content: '请只回复：连接成功' }]);
    const answer = (data as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content;
    if (status >= 200 && status < 300 && answer) return { ok: true, detail: `连接成功（${status}），模型已回复。` };
    const err = (data as { error?: { message?: string }; message?: string } | null)?.error?.message
      || (data as { message?: string } | null)?.message
      || JSON.stringify(data).slice(0, 160);
    return { ok: false, detail: `接口返回 ${status}：${err}` };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { ok: false, detail: msg };
  }
}
