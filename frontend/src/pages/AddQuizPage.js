import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLang } from '../hooks/useLang';
import api from '../api/auth';

function AddQuizPage() {
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [templateType, setTemplateType] = useState('flash');
  const [questions, setQuestions] = useState([{ question: '', time: 60, answer: '' }]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { id } = useParams();
  const { lang } = useLang();

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
        lang  // <-- передаём текущий язык
      };
      console.log('📤 Отправка payload:', payload);

      if (id) {
        await api.put(`/quizzes/${id}`, payload);
      } else {
        await api.post('/quizzes/', payload);
      }
      navigate('/dashboard/cards');
    } catch (err) {
      console.error('❌ Ошибка сохранения:', err.response?.data || err.message);
      alert('Ошибка сохранения');
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>{id ? 'Редактировать квиз' : 'Создать новый квиз'}</h1>
      <form onSubmit={handleSubmit} style={styles.form}>
        <label style={styles.label}>{'Название'}</label>
        <input type="text" value={title} onChange={e => setTitle(e.target.value)} style={styles.input} required />

        <label style={styles.label}>{'Тема'}</label>
        <input type="text" value={topic} onChange={e => setTopic(e.target.value)} style={styles.input} />

        <label style={styles.label}>Тип квиза</label>
        <select value={templateType} onChange={e => setTemplateType(e.target.value)} style={styles.input}>
          <option value="flash">Flash (вопрос-ответ)</option>
          <option value="live">Live (голосование)</option>
          <option value="sprint">Sprint (скоростной)</option>
        </select>

        <div style={styles.questionsHeader}>
          <h3>{'Вопросы'}</h3>
          <button type="button" onClick={addQuestion} style={styles.addBtn}>+ {'Добавить вопрос'}</button>
        </div>

        {questions.map((q, index) => (
          <div key={index} style={styles.questionBlock}>
            <div style={styles.questionRow}>
              <input
                type="text"
                placeholder={'Вопрос'}
                value={q.question}
                onChange={(e) => handleQuestionChange(index, 'question', e.target.value)}
                style={{...styles.input, flex: 2}}
                required
              />
              <input
                type="number"
                placeholder={'Время (сек)'}
                value={q.time}
                onChange={(e) => handleQuestionChange(index, 'time', e.target.value)}
                style={{...styles.input, width: '120px'}}
                min="5"
                required
              />
              <input
                type="text"
                placeholder={'Ответ'}
                value={q.answer}
                onChange={(e) => handleQuestionChange(index, 'answer', e.target.value)}
                style={{...styles.input, flex: 2}}
                required
              />
              <button type="button" onClick={() => removeQuestion(index)} style={styles.removeBtn}>✕</button>
            </div>
          </div>
        ))}

        <div style={styles.buttons}>
          <button type="submit" style={styles.submitBtn} disabled={loading}>
            {loading ? 'Сохранение...' : 'Сохранить'}
          </button>
          <button type="button" onClick={() => navigate('/dashboard/cards')} style={styles.cancelBtn}>
            {'Отмена'}
          </button>
        </div>
      </form>
    </div>
  );
}

const styles = {
  container: { padding: '2rem', maxWidth: '800px', margin: '0 auto' },
  title: { fontSize: '2rem', fontWeight: '900', color: '#1a2e4a', marginBottom: '2rem' },
  form: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  label: { fontWeight: 'bold', color: '#1a2e4a' },
  input: { padding: '10px', borderRadius: '12px', border: '2px solid #c8f0ea', fontSize: '1rem' },
  questionsHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' },
  addBtn: { background: '#3dbdaa', color: 'white', border: 'none', padding: '6px 16px', borderRadius: '20px', cursor: 'pointer' },
  questionBlock: { background: '#f9fcfc', padding: '1rem', borderRadius: '12px', border: '1px solid #c8f0ea' },
  questionRow: { display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' },
  removeBtn: { background: '#e05050', color: 'white', border: 'none', borderRadius: '50%', width: '30px', height: '30px', fontSize: '1rem', cursor: 'pointer' },
  buttons: { display: 'flex', gap: '1rem', marginTop: '1rem' },
  submitBtn: { background: '#3dbdaa', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '20px', fontSize: '1rem', cursor: 'pointer' },
  cancelBtn: { background: '#e0e0e0', color: '#333', border: 'none', padding: '10px 24px', borderRadius: '20px', fontSize: '1rem', cursor: 'pointer' },
};

export default AddQuizPage;