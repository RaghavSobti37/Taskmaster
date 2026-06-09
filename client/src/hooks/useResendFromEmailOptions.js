import { useCallback, useMemo, useState } from 'react';
import {
  addCustomResendEmail,
  getAllResendFromEmails,
  getCustomResendEmails,
} from '../constants/resendFromEmails';

export function useResendFromEmailOptions() {
  const [customVersion, setCustomVersion] = useState(0);

  const options = useMemo(() => {
    void customVersion;
    return getAllResendFromEmails();
  }, [customVersion]);

  const addEmail = useCallback((email) => {
    const result = addCustomResendEmail(email);
    if (result.ok) setCustomVersion((v) => v + 1);
    return result;
  }, []);

  const customEmails = useMemo(() => {
    void customVersion;
    return getCustomResendEmails();
  }, [customVersion]);

  return { options, customEmails, addEmail };
}
