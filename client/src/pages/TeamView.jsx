import React, { useState, useEffect } from 'react';
import TeamMemberCard from '../components/TeamMemberCard';
import CreateTaskModal from '../components/CreateTaskModal';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import PageLoader from '../components/PageLoader';
import './TeamView.css';

const TeamView = () => {
  const { user: currentUser } = useAuth();
  const [allUsers, setAllUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [myTeam, setMyTeam] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [assignee, setAssignee] = useState(null);

  const fetchAllUsers = async () => {
    try {
      const { data } = await api.get('/users/all');
      setAllUsers(data);
      // Filter out current user
      if (currentUser) {
        const filtered = data.filter(user => user._id !== currentUser._id);
        setFilteredUsers(filtered);
      } else {
        setFilteredUsers(data);
      }
    } catch (error) {
      console.error("Failed to fetch all users", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMyTeam = async () => {
    try {
      const { data } = await api.get('/users/team');
      setMyTeam(data);
    } catch (error) {
      console.error("Failed to fetch my team", error);
    }
  };

  useEffect(() => {
    fetchAllUsers();
    fetchMyTeam();
  }, [currentUser]);

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
      fetchMyTeam(); // Refetch the team to show the new member
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
      fetchMyTeam();
    } catch (error) {
      console.error('Failed to create/assign task', error);
    }
  };

  return (
    <div>
      {isModalOpen && <CreateTaskModal onClose={() => setIsModalOpen(false)} onCreateTask={handleCreateTask} assignee={assignee} />}
      <div className="team-header">
        <h1>All Users</h1>
        <div className="team-search-container">
          <input
            type="text"
            className="team-search-input"
            placeholder="Find users to add to your team..."
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
        <PageLoader text="Loading users..." />
      ) : filteredUsers.length === 0 ? (
        <div className="add-friend-prompt">
          <h2>No other users found!</h2>
          <p>Create more accounts to build your team.</p>
        </div>
      ) : (
        <div className="team-grid">
          {filteredUsers.map(user => (
            <TeamMemberCard key={user._id} member={user} onAssignTask={handleOpenAssignModal} />
          ))}
        </div>
      )}
    </div>
  );
};

export default TeamView;