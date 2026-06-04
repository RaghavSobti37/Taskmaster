#!/bin/sh
case "$GIT_AUTHOR_EMAIL" in
  redacted@example.com|REDACTED_ADMIN@example.com|redacted@example.com)
    export GIT_AUTHOR_EMAIL="redacted@example.com"
    export GIT_AUTHOR_NAME="Redacted User"
    ;;
esac
case "$GIT_COMMITTER_EMAIL" in
  redacted@example.com|REDACTED_ADMIN@example.com|redacted@example.com)
    export GIT_COMMITTER_EMAIL="redacted@example.com"
    export GIT_COMMITTER_NAME="Redacted User"
    ;;
esac
case "$GIT_AUTHOR_NAME" in
  RaghavSobti37) export GIT_AUTHOR_NAME="Redacted User" ;;
esac
case "$GIT_COMMITTER_NAME" in
  RaghavSobti37) export GIT_COMMITTER_NAME="Redacted User" ;;
esac
