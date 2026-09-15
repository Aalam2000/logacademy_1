import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import api from '../api/auth';

function CardsPage() {
  const [filter, setFilter] = useState('');
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCards();
  }, []);

  const fetchCards = async () => {
    try {
      const res = await api.get('/quizzes/');
      setCards(res.data);
    } catch (err) {
      alert('Ошибка загрузки списка');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Удалить квиз?')) return;
    try {
      await api.delete(`/quizzes/${id}`);
      fetchCards();
    } catch (err) {
      alert('Ошибка удаления');
    }
  };

  const handleOpen = async (id) => {
    try {
      const res = await api.get(`/quizzes/${id}/html`); // без params
      const win = window.open('', '_blank');
      win.document.write(res.data.html);
      win.document.close();
    } catch (err) {
      alert('Ошибка загрузки HTML');
    }
  };

  const handleEdit = (id) => {
    navigate(`/dashboard/add-quiz/${id}`);
  };

  const filteredCards = cards.filter(card =>
    card.title.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="page page--full">
      <h1 className="page-title">{'Квизы'}</h1>
      <div className="toolbar toolbar--start">
        <input
          type="text"
          placeholder={'Фильтр по названию...'}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="input input--filter"
        />
        <Button onClick={() => navigate('/dashboard/add-quiz')} className="btn--pill btn--bold">
          ➕ {'Добавить'}
        </Button>
      </div>
      <div className="table-scroll">
        <table className="table table--card">
          <thead>
            <tr>
              <th className="table__col--date">{'Дата создания'}</th>
              <th>{'Название'}</th>
              <th>{'Тема'}</th>
              <th className="table__col--action">{'Открыть'}</th>
              <th className="table__col--action">{'Редактировать'}</th>
              <th className="table__col--delete">{'Удалить'}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" className="table__empty">{'Загрузка...'}</td></tr>
            ) : filteredCards.length === 0 ? (
              <tr><td colSpan="6" className="table__empty">{'Нет опросников'}</td></tr>
            ) : (
              filteredCards.map(card => (
                <tr key={card.id}>
                  <td className="nowrap">{new Date(card.created_at).toLocaleDateString()}</td>
                  <td>{card.title}</td>
                  <td>{card.topic || '—'}</td>
                  <td><Button onClick={() => handleOpen(card.id)} className="btn--sm">📂</Button></td>
                  <td><Button onClick={() => handleEdit(card.id)} className="btn--sm">✏️</Button></td>
                  <td><Button onClick={() => handleDelete(card.id)} variant="danger" className="btn--sm">🗑️</Button></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default CardsPage;
