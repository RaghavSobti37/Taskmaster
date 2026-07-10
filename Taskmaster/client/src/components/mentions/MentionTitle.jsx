import React from 'react';
import { useUserDirectory } from '../../hooks/useTaskmasterQueries';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import MentionRichText from './MentionRichText';

const fetchAssets = async () => {
  const { data } = await axios.get('/api/assets');
  return Array.isArray(data) ? data : [];
};

/** Inline task title with @user / #asset rendering for list/kanban rows. */
const MentionTitle = ({ text, className = '', truncate = false }) => {
  const { data: users = [] } = useUserDirectory();
  const { data: assets = [] } = useQuery({
    queryKey: ['assets', 'mention-picker'],
    queryFn: fetchAssets,
    staleTime: 1000 * 60 * 5,
  });

  if (!text) return null;

  return (
    <MentionRichText
      text={text}
      users={users}
      assets={assets}
      inline={!truncate}
      truncate={truncate}
      className={className}
      title={truncate ? text : undefined}
    />
  );
};

export default MentionTitle;
