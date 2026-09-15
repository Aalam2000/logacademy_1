import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLang } from '../hooks/useLang';
import Button from '../components/Button';
import api from '../api/auth';

function AddQuizPage() {
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [templateType, setTemplateType] = useState('flash');
  const [questions, setQuestions] = useState([{ question: '', time: 60, answer: '' }]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const lessonId = searchParams.get('lessonId');
  const { lang } = useLang();

  // Куда возвращаться после сохранения/отмены: если пришли из урока — назад
  // в урок (квиз уже будет привязан), иначе — в общий список квизов.
  const returnPath = lessonId ? `/dashboard/lessons/${lessonId}` : '/dashboard/cards';

  console.log('🌐 Текущий язык в AddQuizPage:', lang);

  useEffect(() => {
    if (id) {
      const fetchQuiz = async () => {
        try {
          const res = await api.get(`/quizzes/${id}/edit`);
          setTitle(res.data.title);
          setTopic(res.data.topic || '');
          setTemplateType(res.data.template_type || 'flash');
          if (res.data.questions && res.data.questions.length > 0) {
            const loadedQuestions = res.data.questions.map(q => ({
              ...q,
              time: typeof q.time === 'number' ? q.time : parseInt(q.time, 10) || 60
            }));
            setQuestions(loadedQuestions);
          } else {
            setQuestions([{ question: '', time: 60, answer: '' }]);
          }
        } catch (err) {
          alert('Ошибка загрузки квиза');
          navigate('/dashboard/cards');
        }
      };
      fetchQuiz();
    }
  }, [id, navigate]);

  const addQuestion = () => {
    setQuestions([...questions, { question: '', time: 60, answer: '' }]);
  };

  const removeQuestion = (index) => {
    if (questions.length === 1) return;
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleQuestionChange = (index, field, value) => {
    setQuestions(prev => {
      const updated = [...prev];
      if (field === 'time') {
        const num = parseInt(value, 10);
        updated[index][field] = isNaN(num) ? 60 : num;
      } else {
        updated[index][field] = value;
      }
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) { alert('Введите название'); return; }
    if (questions.some(q => !q.question.trim() || !q.answer.trim())) {
      alert('Все вопросы и ответы должны быть заполнены');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        title,
        topic,
        template_type: templateType,
        questions,
        lang,  // <-- передаём текущий язык
        ...(!id && lessonId ? { lesson_id: Number(lessonId) } : {}),
      };
      console.log('📤 Отправка payload:', payload);

      if (id) {
        await api.put(`/quizzes/${id}`, payload);
      } else {
        await api.post('/quizzes/', payload);
      }
      navigate(returnPath);
    } catch (err) {
      console.error('❌ Ошибка сохранения:', err.response?.data || err.message);
      alert('Ошибка сохранения');
      setLoading(false);
    }
  };

  return (
    <div className="page page--wide">
      <h1 className="page-title">{id ? 'Редактировать квиз' : 'Создать новый квиз'}</h1>
      {!id && lessonId && (
        <p className="hint-text">{'Квиз будет автоматически привязан к этому уроку.'}</p>
      )}
      <form onSubmit={handleSubmit} className="form-stack">
        <label className="form-label">{'Название'}</label>
        <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="input input--lg" required />

        <label className="form-label">{'Тема'}</label>
        <input type="text" value={topic} onChange={e => setTopic(e.target.value)} className="input input--lg" />

        <label className="form-label">Тип квиза</label>
        <select value={templateType} onChange={e => setTemplateType(e.target.value)} className="input input--lg">
          <option value="flash">Flash (вопрос-ответ)</option>
          <option value="live">Live (голосование)</option>
          <option value="sprint">Sprint (скоростной)</option>
        </select>

        <div className="questions-header">
          <h3>{'Вопросы'}</h3>
          <Button type="button" onClick={addQuestion} className="btn--pill">+ {'Добавить вопрос'}</Button>
        </div>

        {questions.map((q, index) => (
          <div key={index} className="question-card">
            <div className="question-row">
              <input
                type="text"
                placeholder={'Вопрос'}
                value={q.question}
                onChange={(e) => handleQuestionChange(index, 'question', e.target.value)}
                className="input input--lg input--grow"
                required
              />
              <input
                type="number"
                placeholder={'Время (сек)'}
                value={q.time}
                onChange={(e) => handleQuestionChange(index, 'time', e.target.value)}
                className="input input--lg input--time"
                min="5"
                required
              />
              <input
                type="text"
                placeholder={'Ответ'}
                value={q.answer}
                onChange={(e) => handleQuestionChange(index, 'answer', e.target.value)}
                className="input input--lg input--grow"
                required
              />
              <Button type="button" onClick={() => removeQuestion(index)} variant="danger" className="btn--icon-circle">✕</Button>
            </div>
          </div>
        ))}

        <div className="form-actions">
          <Button type="submit" className="btn--pill" disabled={loading}>
            {loading ? 'Сохранение...' : 'Сохранить'}
          </Button>
          <Button type="button" onClick={() => navigate(returnPath)} variant="secondary" className="btn--pill">
            {'Отмена'}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default AddQuizPage;
