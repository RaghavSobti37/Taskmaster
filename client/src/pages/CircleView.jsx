import React, { useState, useEffect } from 'react';
import CircleMemberCard from '../components/CircleMemberCard';
import CreateTaskModal from '../components/CreateTaskModal';
import api from '../services/api';
import './CircleView.css';

const CircleView = () => {
  const [circle, setCircle] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [assignee, setAssignee] = useState(null);

  const fetchCircle = async () => {
    try {
      const { data } = await api.get('/users/circle');
      setCircle(data);
    } catch (error) {
      console.error("Failed to fetch circle", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCircle();
  }, []);

  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(() => {
      api.get(`/users/search?q=${searchQuery}`)
        .then(res => setSearchResults(res.data))
        .catch(err => console.error(err));
    }, 300); // 300ms delay

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const handleAddUser = async (userId) => {
    try {
      await api.post('/users/circle', { userIdToAdd: userId });
      setSearchQuery('');
      setSearchResults([]);
      fetchCircle(); // Refetch the circle to show the new member
    } catch (error) {
      console.error('Failed to add user to circle', error);
      alert('Could not add user.');
    }
  };

  const handleOpenAssignModal = (member) => {
    setAssignee(member);
    setIsModalOpen(true);
  };

  const handleCreateTask = async (newTaskData) => {
    try {
      await api.post('/tasks', newTaskData);
      setIsModalOpen(false);
      setAssignee(null);
      // Optionally, you can refetch the circle data to show the new task count
      fetchCircle();
    } catch (error) {
      console.error('Failed to create/assign task', error);
    }
  };

  return (
    <div>
      {isModalOpen && <CreateTaskModal onClose={() => setIsModalOpen(false)} onCreateTask={handleCreateTask} assignee={assignee} />}
      <div className="circle-header">
        <h1>Circle</h1>
        <div className="circle-search-container">
          <input
            type="text"
            className="circle-search-input"
            placeholder="Find users to add..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchResults.length > 0 && (
            <div className="search-results-dropdown">
              <ul>
                {searchResults.map(user => (
                  <li key={user._id}>
                    <span>{user.username}</span>
                    <button className="add-user-btn" onClick={() => handleAddUser(user._id)}>Add</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <p>Loading circle...</p>
      ) : circle.length === 0 ? (
        <div className="add-friend-prompt">
          <h2>Your circle is empty!</h2>
          <p>Add friends by searching for their username.</p>
        </div>
      ) : (
        <div className="circle-grid">
          {circle.map(member => (
            <CircleMemberCard key={member._id} member={member} onAssignTask={handleOpenAssignModal} />
          ))}
        </div>
      )}
    </div>
  );
};

export default CircleView;