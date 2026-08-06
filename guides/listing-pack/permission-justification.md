# Permission Justification - Scam Guard

Har store (Chrome, Edge, Firefox) yeh puchta hai ke extension ko yeh permissions
kyun chahiyein. Neeche ready text hai - seedha paste karein.

## Why the extension needs permissions

Scam Guard is a phishing and fake website detector. To do its one job - warn you
before you enter your password on a fake site - it needs to know which website
you are currently visiting. That is the only reason for any of the permissions
below.

### storage

Saves your settings, sensitivity level, and your blocked/trusted site lists.
Everything is stored only in your own browser; nothing is uploaded anywhere.

### tabs

Reads the web address (URL) of the current tab only, so Scam Guard can check
whether the site you are visiting is a phishing or fake website. It never reads
page content, passwords, or personal data.

### Read/change all websites' data (host permissions / `<all_urls>`)

Lets the extension check the URL of every website you open so it can show a
full-screen warning BEFORE you enter your password on a fake site. All detection
runs locally inside the browser; no data is sent to any server.

## Single purpose statement (Chrome specifically asks)

> Scam Guard's single purpose is to detect and warn users about phishing and fake
> websites before they enter sensitive information. It reads only the URL of the
> active tab, checks it locally against bundled scam-detection rules, and shows a
> warning. It does not collect, transmit, or sell any data.
