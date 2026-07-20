import { useMutation, useQuery } from '@tanstack/react-query';
import { buildAutoMailerUrl } from '../../utils/autoMailerUrl';

export const newsletterKeys = {
  all: ['newsletter'],
  current: () => [...newsletterKeys.all, 'current'],
  issue: (weekKey) => [...newsletterKeys.all, 'issue', weekKey],
  categories: () => [...newsletterKeys.all, 'categories'],
  preview: (issueId) => [...newsletterKeys.all, 'preview', issueId],
};

const movedToAutoMailer = (path = '/emails/newsletter') => ({
  moved: true,
  service: 'auto-mailer',
  url: buildAutoMailerUrl(path),
  message: 'Newsletter workflows moved to Auto-Mailer',
});

const useMovedQuery = (queryKey, path, options = {}) => useQuery({
  queryKey,
  queryFn: async () => movedToAutoMailer(path),
  enabled: options.enabled ?? true,
  staleTime: Infinity,
});

const useMovedMutation = (path) => useMutation({
  mutationFn: async () => movedToAutoMailer(path),
});

export const useNewsletterCategories = () => useMovedQuery(newsletterKeys.categories(), '/emails/newsletter');
export const useCurrentNewsletterIssue = () => useMovedQuery(newsletterKeys.current(), '/emails/newsletter');
export const useNewsletterIssue = (weekKey, enabled = true) =>
  useMovedQuery(newsletterKeys.issue(weekKey), '/emails/newsletter', { enabled: enabled && !!weekKey });
export const usePreviewNewsletterLink = () => useMovedMutation('/emails/newsletter');
export const useCreateNewsletterArticle = () => useMovedMutation('/emails/newsletter');
export const useUpdateNewsletterArticle = () => useMovedMutation('/emails/newsletter');
export const useDeleteNewsletterArticle = () => useMovedMutation('/emails/newsletter');
export const useCurateNewsletterIssue = () => useMovedMutation('/emails/newsletter');
export const useCompileNewsletterIssue = () => useMovedMutation('/emails/newsletter');
export const useNewsletterHtmlPreview = (issueId, enabled = true) =>
  useMovedQuery(newsletterKeys.preview(issueId), '/emails/newsletter', { enabled: enabled && !!issueId });
export const useNewsletterAudiencePreview = () => useMovedMutation('/emails/newsletter/send');
export const useSendNewsletterIssue = () => useMovedMutation('/emails/newsletter/send');
