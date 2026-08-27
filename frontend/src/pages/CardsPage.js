import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import { useI18n } from '../context/I18nContext';
import api from '../api/auth';

function CardsPage() {
  const [filter, setFilter] = useState('');
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { t, lang } = useI18n();

  useEffect(() => {
    fetchCards();
  }, []);

  const fetchCards = async () => {
    try {
      const res = await api.get('/quizzes/');
      setCards(res.data);
    } catch (err) {
      alert(t('cards_load_error', 'Ошибка загрузки списка'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('cards_delete_confirm', 'Удалить квиз?'))) return;
    try {
      await api.delete(`/quizzes/${id}`);
      fetchCards();
    } catch (err) {
      alert(t('cards_delete_error', 'Ошибка удаления'));
    }
  };

  const handleOpen = async (id) => {
    try {
      const res = await api.get(`/quizzes/${id}/html`); // без params
      const win = window.open('', '_blank');
      win.document.write(res.data.html);
      win.document.close();
    } catch (err) {
      alert(t('cards_open_error', 'Ошибка загрузки HTML'));
    }
  };

  const handleEdit = (id) => {
    navigate(`/dashboard/add-quiz/${id}`);
  };

  const filteredCards = cards.filter(card =>
    card.title.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>{t('cards_title', 'Квизы')}</h1>
      <div style={styles.toolbar}>
        <input
          type="text"
          placeholder={t('cards_filter_placeholder', 'Фильтр по названию...')}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={styles.filterInput}
        />
        <Button onClick={() => navigate('/dashboard/add-quiz')} style={styles.addBtn}>
          ➕ {t('cards_add_button', 'Добавить')}
        </Button>
      </div>
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ width: '150px' }}>{t('cards_table_created', 'Дата создания')}</th>
              <th>{t('cards_table_title', 'Название')}</th>
              <th>{t('cards_table_topic', 'Тема')}</th>
              <th style={{ width: '100px' }}>{t('cards_table_open', 'Открыть')}</th>
              <th style={{ width: '100px' }}>{t('cards_table_edit', 'Редактировать')}</th>
              <th style={{ width: '80px' }}>{t('cards_table_delete', 'Удалить')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" style={styles.empty}>{t('cards_loading', 'Загрузка...')}</td></tr>
            ) : filteredCards.length === 0 ? (
              <tr><td colSpan="6" style={styles.empty}>{t('cards_empty', 'Нет опросников')}</td></tr>
            ) : (
              filteredCards.map(card => (
                <tr key={card.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{new Date(card.created_at).toLocaleDateString()}</td>
                  <td>{card.title}</td>
                  <td>{card.topic || '—'}</td>
                  <td><Button onClick={() => handleOpen(card.id)} style={styles.smallBtn}>📂</Button></td>
                  <td><Button onClick={() => handleEdit(card.id)} style={styles.smallBtn}>✏️</Button></td>
                  <td><Button onClick={() => handleDelete(card.id)} style={{ ...styles.smallBtn, background: '#e05050' }}>🗑️</Button></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const styles = {
  container: { padding: '2rem', width: '100%', maxWidth: '100%', boxSizing: 'border-box' },
  title: { fontSize: '2rem', fontWeight: '900', color: '#1a2e4a', marginBottom: '1.5rem' },
  toolbar: { display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center', flexWrap: 'wrap' },
  filterInput: { padding: '8px 12px', borderRadius: '12px', border: '2px solid #c8f0ea', fontSize: '1rem', flex: '1 1 200px' },
  addBtn: { background: '#3dbdaa', color: 'white', border: 'none', padding: '8px 20px', borderRadius: '20px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer' },
  tableWrapper: { overflowX: 'auto', width: '100%' },
  table: { width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', minWidth: '600px' },
  smallBtn: {
    background: '#3dbdaa',
    color: 'white',
    border: 'none',
    padding: '4px 8px',
    borderRadius: '8px',
    fontSize: '0.8rem',
    cursor: 'pointer',
    minWidth: '30px',
  },
  empty: { textAlign: 'center', padding: '2rem', color: '#6a8aaa' },
};

export default CardsPage;