#!/bin/sh
sed \
  -e 's/taskmaster-jfw0\.onrender\.com/YOUR-RENDER-SERVICE.onrender.com/g' \
  -e 's/coreknot-api\.onrender\.com/YOUR-RENDER-SERVICE.onrender.com/g' \
  -e 's/raghavsobti37@gmail\.com/redacted@example.com/g' \
  -e 's/raghavraj@theshakticollective\.in/REDACTED_ADMIN@example.com/g' \
  -e 's/raghav@gmail\.com/redacted@example.com/g' \
  -e 's/harshika@theshakticollective\.in/redacted-staff@example.com/g' \
  -e 's/deepank@theshakticollective\.in/redacted-staff@example.com/g' \
  -e 's/aryaman@theshakticollective\.in/redacted-staff@example.com/g' \
  -e 's/rohith@theshakticollective\.in/redacted-staff@example.com/g' \
  -e 's/Raghav Raj Sobti/Redacted User/g' \
  -e 's/Raghav Sobti/Redacted User/g' \
  -e 's/RaghavSobti37/YOUR_ORG/g' \
  -e 's|github.com/YOUR_ORG|github.com/YOUR_ORG|g'
