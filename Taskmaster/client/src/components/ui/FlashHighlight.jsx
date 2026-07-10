import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { applyFlashHighlight } from '../../utils/navigationHighlight';

/** Applies flash highlight when URL contains ?highlight=id */
const FlashHighlightListener = () => {
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const highlightId = params.get('highlight');
    if (highlightId) applyFlashHighlight(highlightId);
  }, [location.pathname, location.search]);

  return null;
};

export default FlashHighlightListener;
