import React, { useState, useEffect } from 'react';
import TeamMemberCard from '../components/TeamMemberCard';
import CreateTaskModal from '../components/CreateTaskModal';
import api from '../services/api';
import './TeamView.css';

const TeamView = () => {
  const [team, setTeam] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [assignee, setAssignee] = useState(null);

  const fetchTeam = async () => {
    try {
      const { data } = await api.get('/users/team');
      setTeam(data);
    } catch (error) {
      console.error("Failed to fetch team", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTeam();
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
      await api.post('/users/team', { userIdToAdd: userId });
      setSearchQuery('');
      setSearchResults([]);
      fetchTeam(); // Refetch the team to show the new member
    } catch (error) {
      console.error('Failed to add user to team', error);
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
      // Optionally, you can refetch the team data to show the new task count
      fetchTeam();
    } catch (error) {
      console.error('Failed to create/assign task', error);
    }
  };

  return (
    <div>
      {isModalOpen && <CreateTaskModal onClose={() => setIsModalOpen(false)} onCreateTask={handleCreateTask} assignee={assignee} />}
      <div className="team-header">
        <h1>Team</h1>
        <div className="team-search-container">
          <input
            type="text"
            className="team-search-input"
            placeholder="Find team members to add..."
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
        <p>Loading team...</p>
      ) : team.length === 0 ? (
        <div className="add-friend-prompt">
          <h2>Your team is empty!</h2>
          <p>Add team members by searching for their username.</p>
        </div>
      ) : (
        <div className="team-grid">
          {team.map(member => (
            <TeamMemberCard key={member._id} member={member} onAssignTask={handleOpenAssignModal} />
          ))}
        </div>
      )}
    </div>
  );
};

export default TeamView;