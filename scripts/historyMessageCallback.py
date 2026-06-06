for old, new in [
    (b'taskmaster-jfw0.onrender.com', b'YOUR-RENDER-SERVICE.onrender.com'),
    (b'coreknot-api.onrender.com', b'YOUR-RENDER-SERVICE.onrender.com'),
    (b'raghavraj@theshakticollective.in', b'REDACTED_ADMIN@example.com'),
    (b'raghavsobti37@gmail.com', b'redacted@example.com'),
    (b'raghav@gmail.com', b'redacted@example.com'),
    (b'harshika@theshakticollective.in', b'redacted-staff@example.com'),
    (b'deepank@theshakticollective.in', b'redacted-staff@example.com'),
    (b'aryaman@theshakticollective.in', b'redacted-staff@example.com'),
    (b'rohith@theshakticollective.in', b'redacted-staff@example.com'),
    (b'github.com/RaghavSobti37', b'github.com/YOUR_ORG'),
    (b'RaghavSobti37/CoreKnot', b'YOUR_ORG/CoreKnot'),
    (b'RaghavSobti37/Taskmaster', b'YOUR_ORG/Taskmaster'),
    (b'Raghav Raj Sobti', b'Redacted User'),
    (b'Raghav Sobti', b'Redacted User'),
    (b'RaghavSobti37', b'YOUR_ORG'),
]:
    message = message.replace(old, new)
return message
