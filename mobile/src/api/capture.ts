import type { SmsTemplate } from '@/capture/parser';
import { request } from './client';
import type { CaptureRule, CaptureRuleInput, RecordedRef } from './types';

export const captureApi = {
  /** Which of these capture keys are already recorded (by me, or by anyone in my groups)? */
  match: (keys: string[]) =>
    request<{ recorded: Record<string, RecordedRef> }>({ method: 'POST', url: '/capture/match', data: { keys } }),
  rules: () => request<CaptureRule[]>({ method: 'GET', url: '/capture/rules' }),
  saveRule: (body: CaptureRuleInput) => request<CaptureRule>({ method: 'PUT', url: '/capture/rules', data: body }),
  deleteRule: (id: string) => request<void>({ method: 'DELETE', url: `/capture/rules/${id}` }),
  templates: () => request<(SmsTemplate & { uses: number })[]>({ method: 'GET', url: '/capture/templates' }),
  teach: (tpl: SmsTemplate) => request<SmsTemplate>({ method: 'POST', url: '/capture/templates', data: tpl }),
};
