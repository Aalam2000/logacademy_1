// «Помощник» редактора квиза — без трат на API: собирает готовый промпт,
// педагог сам отдаёт его любому ИИ, вставляет ответ (JSON) обратно, и
// квиз заполняется целиком (всегда «Заменить» — квиз делается заново).
import React, { useState } from 'react';

const LANG_NAMES = { ru: 'русский', az: 'азербайджанский', en: 'английский' };

const FORMATS = {
  flash: {
    kind: 'квиз «вопрос — ответ» для показа на проекторе: ведущий показывает вопрос, дети отвечают устно, затем показывается правильный ответ',
    rules: [
      'Ответ — короткий: слово, число или одна фраза (до 10 слов).',
    ],
    example: (t) => `{"title":"Название квиза","topic":"Тема","questions":[{"question":"Текст вопроса?","answer":"Короткий ответ","time":${t}}]}`,
  },
  live: {
    kind: 'квиз с выбором ответа (как Kahoot): у каждого вопроса ровно 4 варианта, правильный — один',
    rules: [
      'У каждого вопроса ровно 4 варианта в "options", все разные и правдоподобные.',
      '"correct_index" — номер правильного варианта: 0, 1, 2 или 3. Правильный ответ ставь в разные позиции.',
      'Варианты короткие — до 8 слов.',
    ],
    example: (t) => `{"title":"Название квиза","topic":"Тема","questions":[{"question":"Текст вопроса?","options":["Вариант 1","Вариант 2","Вариант 3","Вариант 4"],"correct_index":2,"time":${t}}]}`,
  },
};

export function buildQuizPrompt({ type, wish, count, time, lang }) {
  const f = FORMATS[type];
  return [
    `Ты — методист детской IT-академии (ученики 8–14 лет). Составь ${f.kind}.`,
    '',
    `Задание от преподавателя: ${wish.trim() || '(тема не указана — придумай по названию курса)'}`,
    '',
    `Количество вопросов: ${count}.`,
    `Язык вопросов и ответов: ${LANG_NAMES[lang] || lang}.`,
    `Время на каждый вопрос: ${time} секунд (поле "time").`,
    '',
    'Требования:',
    '- Вопросы короткие и понятные ребёнку, без двусмысленности, каждый проверяет одну мысль.',
    ...f.rules.map(r => `- ${r}`),
    '- Если в задании уже даны вопросы и ответы — используй их (можно слегка поправить формулировки), недостающие придумай сам.',
    '',
    'Ответь ТОЛЬКО одним JSON-объектом — без пояснений, без markdown и без ```. Строго в таком формате:',
    f.example(time),
  ].join('\n');
}

// Разбор ответа ИИ: снимаем ``` обёртку, находим JSON в тексте, проверяем каждый вопрос.
export function parseQuizJson(text, type, defaultTime) {
  let raw = (text || '').trim().replace(/^```[a-zA-Z]*\s*/, '').replace(/```\s*$/, '');
  const start = raw.search(/[[{]/);
  if (start < 0) throw new Error('В тексте не найден JSON');
  const end = Math.max(raw.lastIndexOf('}'), raw.lastIndexOf(']'));
  raw = raw.slice(start, end + 1);
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new Error(`JSON не читается: ${e.message}`);
  }
  const list = Array.isArray(data) ? data : data.questions;
  if (!Array.isArray(list) || list.length === 0) throw new Error('Нет списка вопросов ("questions")');

  const errors = [];
  const questions = list.map((q, i) => {
    const n = i + 1;
    const question = String(q?.question ?? '').trim();
    if (!question) errors.push(`вопрос ${n}: пустой текст вопроса`);
    let time = parseInt(q?.time, 10);
    if (Number.isNaN(time) || time < 5) time = defaultTime;
    if (type === 'live') {
      const options = Array.isArray(q?.options) ? q.options.map(o => String(o ?? '').trim()) : [];
      if (options.length !== 4 || options.some(o => !o)) errors.push(`вопрос ${n}: нужно ровно 4 непустых варианта`);
      const ci = Number(q?.correct_index);
      if (!Number.isInteger(ci) || ci < 0 || ci > 3) errors.push(`вопрос ${n}: нет правильного ответа (correct_index 0–3)`);
      return { question, time, options: options.slice(0, 4).concat(['', '', '', '']).slice(0, 4), correct_index: Number.isInteger(ci) ? ci : 0 };
    }
    const answer = String(q?.answer ?? '').trim();
    if (!answer) errors.push(`вопрос ${n}: нет ответа`);
    return { question, time, answer };
  });
  if (errors.length) throw new Error(errors.join('; '));
  return {
    title: Array.isArray(data) ? '' : String(data.title ?? '').trim(),
    topic: Array.isArray(data) ? '' : String(data.topic ?? '').trim(),
    questions,
  };
}

function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  return Promise.resolve();
}

function QuizHelper({ templateType, lang, onFill }) {
  const [wish, setWish] = useState('');
  const [count, setCount] = useState(10);
  const [time, setTime] = useState(templateType === 'live' ? 30 : 60);
  const [qLang, setQLang] = useState(LANG_NAMES[lang] ? lang : 'ru');
  const [prompt, setPrompt] = useState('');
  const [copied, setCopied] = useState(false);
  const [aiText, setAiText] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const makePrompt = () => {
    setPrompt(buildQuizPrompt({ type: templateType, wish, count, time, lang: qLang }));
    setCopied(false);
  };

  const copy = async () => {
    try {
      await copyText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Не удалось скопировать — выделите текст и скопируйте вручную');
    }
  };

  const fill = () => {
    setError('');
    setDone('');
    try {
      const result = parseQuizJson(aiText, templateType, time);
      onFill(result);
      setDone(`Готово: ${result.questions.length} вопросов. Проверьте и нажмите «Сохранить».`);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="question-card quiz-helper">
      <h3 className="quiz-helper__title">{'Помощник'}</h3>
      <p className="hint-text">
        {'1) Опишите, что нужно, и соберите промпт. 2) Вставьте его в любой ИИ. 3) Ответ ИИ (JSON) вставьте ниже — квиз заполнится заново.'}
      </p>

      <label className="form-label">{'Что нужно: тема, пожелания или готовые вопросы с ответами'}</label>
      <textarea className="input quiz-helper__area" rows={4} value={wish} onChange={e => setWish(e.target.value)} />

      <div className="quiz-helper__row">
        <label className="form-label">
          {'Вопросов'}
          <input type="number" min="1" max="50" className="input input--time" value={count}
            onChange={e => setCount(Math.max(1, parseInt(e.target.value, 10) || 1))} />
        </label>
        <label className="form-label">
          {'Секунд на вопрос'}
          <input type="number" min="5" className="input input--time" value={time}
            onChange={e => setTime(Math.max(5, parseInt(e.target.value, 10) || 5))} />
        </label>
        <label className="form-label">
          {'Язык'}
          <select className="input" value={qLang} onChange={e => setQLang(e.target.value)}>
            {Object.entries(LANG_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <button type="button" className="btn" onClick={makePrompt}>{'Собрать промпт'}</button>
      </div>

      {prompt && (
        <>
          <label className="form-label">{'Промпт — скопируйте и вставьте в ИИ'}</label>
          <textarea className="input quiz-helper__area quiz-helper__prompt" rows={8} value={prompt} readOnly onFocus={e => e.target.select()} />
          <div>
            <button type="button" className="btn btn--outline" onClick={copy}>{copied ? 'Скопировано' : 'Скопировать'}</button>
          </div>

          <label className="form-label">{'Ответ ИИ (JSON)'}</label>
          <textarea className="input quiz-helper__area" rows={6} value={aiText} onChange={e => setAiText(e.target.value)} />
          <div>
            <button type="button" className="btn" onClick={fill} disabled={!aiText.trim()}>{'Заполнить квиз'}</button>
          </div>
        </>
      )}

      {error && <div className="error-text">{error}</div>}
      {done && <div className="hint-text">{done}</div>}
    </div>
  );
}

export default QuizHelper;
