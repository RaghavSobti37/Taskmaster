import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import ChatSidebar from '../../components/chat/ChatSidebar';
import ChatThread from '../../components/chat/ChatThread';
import CreateChannelModal from '../../components/chat/CreateChannelModal';
import NewDmModal from '../../components/chat/NewDmModal';
import {
  useChatChannels,
  useOpenDm,
  useCreateGroupChannel,
} from '../../hooks/useChat';

const LAST_CHANNEL_KEY = 'chat:lastChannelId';
const COMPACT_BREAKPOINT = 768;

const sortByRecent = (list) =>
  [...list].sort((a, b) => {
    const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return tb - ta;
  });

function useCompactChatLayout() {
  const [compact, setCompact] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < COMPACT_BREAKPOINT
  );

  useEffect(() => {
    const onResize = () => setCompact(window.innerWidth < COMPACT_BREAKPOINT);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return compact;
}

const ChatPage = () => {
  const { user } = useAuth();
  const compact = useCompactChatLayout();
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightProject = searchParams.get('highlightProject') || '';
  const { data, isLoading, isError, error: channelsError, refetch } = useChatChannels({});
  const openDm = useOpenDm();
  const createGroup = useCreateGroupChannel();

  const [activeChannel, setActiveChannel] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showDm, setShowDm] = useState(false);

  const dms = data?.dms || [];
  const teamChannels = useMemo(
    () => (data?.channels || []).filter((c) => c.type !== 'dm'),
    [data?.channels]
  );

  const conversations = useMemo(
    () => sortByRecent([...dms, ...teamChannels]),
    [dms, teamChannels]
  );

  const allChannels = conversations;

  const selectChannel = useCallback((ch) => {
    setActiveChannel(ch);
    try {
      localStorage.setItem(LAST_CHANNEL_KEY, ch._id);
    } catch {
      /* ignore */
    }
    setSearchParams(
      highlightProject
        ? { channel: ch._id, highlightProject }
        : { channel: ch._id },
      { replace: true }
    );
  }, [setSearchParams, highlightProject]);

  const clearChannel = useCallback(() => {
    setActiveChannel(null);
    const next = highlightProject ? { highlightProject } : {};
    setSearchParams(next, { replace: true });
  }, [setSearchParams, highlightProject]);

  useEffect(() => {
    if (!allChannels.length) {
      setActiveChannel(null);
      return;
    }

    const channelId = searchParams.get('channel');
    if (channelId) {
      const found = allChannels.find((c) => c._id === channelId);
      if (found) {
        setActiveChannel(found);
        return;
      }
    }

    if (compact) {
      setActiveChannel(null);
      return;
    }

    let lastId = null;
    try {
      lastId = localStorage.getItem(LAST_CHANNEL_KEY);
    } catch {
      /* ignore */
    }
    if (lastId) {
      const last = allChannels.find((c) => c._id === lastId);
      if (last) {
        setActiveChannel(last);
        setSearchParams(
          highlightProject
            ? { channel: last._id, highlightProject }
            : { channel: last._id },
          { replace: true }
        );
        return;
      }
    }

    selectChannel(allChannels[0]);
  }, [searchParams, allChannels, selectChannel, highlightProject, setSearchParams, compact]);

  useEffect(() => {
    if (!activeChannel?._id || !allChannels.length) return;
    const fresh = allChannels.find((c) => c._id === activeChannel._id);
    if (fresh) setActiveChannel(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allChannels]);

  const handleOpenDm = async (userId) => {
    try {
      const ch = await openDm.mutateAsync(userId);
      setShowDm(false);
      if (ch) selectChannel(ch);
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to open DM');
    }
  };

  const handleCreateChannel = async (payload) => {
    try {
      const ch = await createGroup.mutateAsync(payload);
      setShowCreate(false);
      if (ch) selectChannel(ch);
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to create channel');
    }
  };

  const handleChannelUpdated = (updated) => {
    if (updated) setActiveChannel(updated);
    refetch();
  };

  const showList = !compact || !activeChannel;
  const showThread = !compact || !!activeChannel;

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden bg-[var(--color-bg-workspace)]">
      {showList && (
        <ChatSidebar
          className={compact ? 'w-full max-w-full border-r-0' : ''}
          conversations={conversations}
          activeChannelId={activeChannel?._id}
          currentUserId={user?._id}
          onSelectChannel={selectChannel}
          onNewChannel={() => setShowCreate(true)}
          onNewDm={() => setShowDm(true)}
          isLoading={isLoading}
          isError={isError}
          compact={compact}
          errorMessage={
            channelsError?.response?.status
              ? `Chat API error (${channelsError.response.status}): ${channelsError.response?.data?.message || channelsError.message}`
              : channelsError?.code === 'ERR_NETWORK'
                ? 'Could not reach chat server. Start the API on port 5000 and refresh.'
                : channelsError?.message || ''
          }
        />
      )}

      {showThread && (
        <ChatThread
          channel={activeChannel}
          onChannelUpdated={handleChannelUpdated}
          onBack={compact && activeChannel ? clearChannel : undefined}
          compact={compact}
          className={compact ? 'flex-1 w-full min-w-0' : 'flex-1 min-w-0'}
        />
      )}

      <CreateChannelModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={handleCreateChannel}
        loading={createGroup.isPending}
      />
      <NewDmModal
        open={showDm}
        onClose={() => setShowDm(false)}
        onSelect={handleOpenDm}
        loading={openDm.isPending}
      />
    </div>
  );
};

export default ChatPage;
