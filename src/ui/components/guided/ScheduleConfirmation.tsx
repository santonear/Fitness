import { AppIcon, StatusIcon } from '../AppIcon';
import { trainingSlotSchema } from '../../../domain/training-time';

export interface ScheduleSlot { date: string; startTime: string; durationMinutes: number }
export function ScheduleConfirmation({ locale, dates, slots, usualTime, durationMinutes, disabled, onChange, onConfirm }: {
  locale: 'zh' | 'en'; dates: string[]; slots: ScheduleSlot[]; usualTime: string; durationMinutes: number;
  disabled: boolean; onChange: (slots: ScheduleSlot[]) => void; onConfirm: () => void;
}) {
  const zh = locale === 'zh';
  const valid = slots.length > 0 && slots.every(slot => trainingSlotSchema.safeParse(slot).success);
  return <section className="guided-section schedule-confirmation" aria-label={zh ? '确认逐日训练时间' : 'Confirm daily training times'}>
    <h2>{zh ? '选择训练日，逐日确认时间' : 'Choose training days and confirm each time'}</h2>
    <p>{zh ? '未选择的日期作为休息日。确认后生成并保存计划；有现行计划时，新计划将替换它，训练历史保留。' : 'Unselected dates are rest days. Confirmation generates and saves your plan, replacing any current plan while preserving training history.'}</p>
    {dates.map(date => {
      const slot = slots.find(item => item.date === date);
      return <fieldset key={date}><legend><label><input type="checkbox" disabled={disabled} checked={!!slot} onChange={event => onChange(event.target.checked ? [...slots, { date, startTime: usualTime, durationMinutes }].sort((a,b) => a.date.localeCompare(b.date)) : slots.filter(item => item.date !== date))} />{date}</label></legend>
        {slot && <><label>{zh ? '开始时间' : 'Start time'}<input type="time" aria-label={`${date} ${zh ? '开始时间' : 'start time'}`} disabled={disabled} value={slot.startTime} onChange={event => onChange(slots.map(item => item.date === date ? { ...item, startTime: event.target.value } : item))} /></label><span> · {slot.durationMinutes} {zh ? '分钟' : 'minutes'}</span>{!trainingSlotSchema.safeParse(slot).success && <p role="alert"><StatusIcon status="warning"/>{zh ? '请选择有效时间，并在当日午夜前结束。' : 'Choose a valid time that ends by midnight.'}</p>}</>}
      </fieldset>;
    })}
    <p id="schedule-quota-notice"><strong>{zh ? '确认后将使用 1 次计划生成额度。仅调整已保存计划的时间不消耗额度。' : 'Confirmation uses 1 plan generation allowance. Changing a saved training time uses no allowance.'}</strong></p>
    <button disabled={disabled || !valid} aria-describedby="schedule-quota-notice" onClick={onConfirm}>{zh ? '确认时间，生成并保存计划' : 'Confirm times, generate and save plan'}</button>
  </section>;
}
