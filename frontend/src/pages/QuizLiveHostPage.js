import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import api from '../api/auth';
import { QUIZ_LIVE_OPTION_STYLES } from '../utils/quizLiveColors';
import { notifyLessonMarksUpdated } from '../utils/lessonMarksChannel';

const POLL_MS = 1500;

function QuizLiveHostPage() {
  const { code } = useParams();
  const [state, setState] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const timerRef = useRef(null);
  const notifiedRef = useRef(false);

  const joinUrl = `${window.location.origin}/quiz-live/${code}`;

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await api.get(`/quiz-live/${code}/host`);
        if (!cancelled) {
          setState(res.data);
          setError('');
        }
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.detail || 'Игра не найдена');
      }
    };
    poll();
    timerRef.current = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timerRef.current);
    };
  }, [code]);

  useEffect(() => {
    if (state?.status === 'finished' && state.is_exam && !notifiedRef.current) {
      notifiedRef.current = true;
      notifyLessonMarksUpdated(state.lesson_id);
    }
  }, [state]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // молча — поле со ссылкой всё равно есть для ручного копирования
    }
  };

  const handleToggleExam = async (checked) => {
    try {
      const res = await api.post(`/quiz-live/${code}/set-exam`, { is_exam: checked });
      setState(res.data);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Не удалось изменить');
    }
  };

  const handleStart = async () => {
    setBusy(true);
    try {
      const res = await api.post(`/quiz-live/${code}/start`);
      setState(res.data);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Не удалось начать');
    } finally {
      setBusy(false);
    }
  };

  const handleNext = async () => {
    setBusy(true);
    try {
      const res = await api.post(`/quiz-live/${code}/next`);
      setState(res.data);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Не удалось переключить');
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return <div className="centered-page"><div className="card"><p className="error-text">{error}</p></div></div>;
  }
  if (!state) {
    return <div className="centered-page">{'Загрузка...'}</div>;
  }

  return (
    <div className="page quiz-live-host">
      <h1 className="page-title">{state.title}</h1>
      {state.topic && <p className="text-muted">{state.topic}</p>}

      {state.status === 'waiting' && (
        <div className="quiz-live-layout">
          <div className="quiz-live-main">
            <div className="qr-frame">
              <QRCodeSVG value={joinUrl} size={220} />
            </div>
            <div className="input-row">
              <input className="input input--soft" value={joinUrl} readOnly onFocus={e => e.target.select()} />
              <button className="btn" onClick={handleCopy}>{copied ? 'Скопировано' : 'Копировать'}</button>
            </div>
            <label className="checkbox-row">
              <input type="checkbox" checked={state.is_exam} onChange={e => handleToggleExam(e.target.checked)} />
              {' '}{'Экзамен — по итогам поставит оценку в урок'}
            </label>
            <button className="btn btn--pill btn--lg" onClick={handleStart} disabled={busy}>{'Провести'}</button>
          </div>
          <div className="quiz-live-participants">
            <h3>{'Участники'}</h3>
            {state.participants.length === 0 && <p className="text-muted">{'Пока никто не зарегистрировался'}</p>}
            {state.participants.map((p, i) => (
              <div key={i} className="quiz-live-participant">{p.name}</div>
            ))}
          </div>
        </div>
      )}

      {state.status === 'active' && (
        <div className="quiz-live-layout">
          <div className="quiz-live-main">
            <p className="text-muted">{`Вопрос ${state.current_question + 1} из ${state.total_questions} · ${state.time_left} сек`}</p>
            <h2 className="quiz-live-question">{state.question}</h2>
            <div className="quiz-live-options-grid">
              {state.options.map((opt, i) => (
                <div key={i} className="quiz-live-option" style={{ background: QUIZ_LIVE_OPTION_STYLES[i].color }}>
                  <span className="quiz-live-option__num">{QUIZ_LIVE_OPTION_STYLES[i].number}</span>
                  {opt}
                </div>
              ))}
            </div>
            <button className="btn btn--pill btn--lg" onClick={handleNext} disabled={busy}>{'Продолжить'}</button>
          </div>
          <div className={`quiz-live-participants${state.all_answered ? ' quiz-live-participants--all' : ''}`}>
            <h3>{'Участники'}</h3>
            {state.participants.map((p, i) => (
              <div key={i} className={`quiz-live-participant${p.answered ? ' quiz-live-participant--answered' : ''}`}>{p.name}</div>
            ))}
          </div>
        </div>
      )}

      {state.status === 'finished' && (
        <div className="quiz-live-results">
          <h3>{'Итоги'}</h3>
          <table className="table">
            <thead><tr><th>{'Ученик'}</th><th>{'Правильных ответов'}</th></tr></thead>
            <tbody>
              {state.results.map((r, i) => (
                <tr key={i} className={i < 3 ? 'quiz-live-leader' : ''}>
                  <td>{r.name}</td>
                  <td>{r.correct_count} / {state.total_questions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default QuizLiveHostPage;
