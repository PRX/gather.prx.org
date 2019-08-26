const COMMON_HEADERS = { 'X-Adzerk-ApiKey': null };
const BASE_URL = 'https://62y4dsxai6.execute-api.us-east-1.amazonaws.com/prod';
let CANCEL_REPORT = false;
const METACACHE = {};

// Handles requests for:
// https://dev.adzerk.com/v1.0/reference/zone#get-zon
// https://dev.adzerk.com/v1.0/reference/creative#get-creative
// https://dev.adzerk.com/v1.0/reference/flight#get-flight
// https://dev.adzerk.com/v1.0/reference/site#get-site
function getMeta(type, id) {
  const url = `${BASE_URL}/management/v1/${type}/${id}`;

  return new Promise((resolve, reject) => {
    if (METACACHE[url]) {
      resolve(METACACHE[url]);
    } else {
      fetch(url, { headers: COMMON_HEADERS })
        .then(response => response.json())
        .then(data => { METACACHE[url] = data; resolve(data); })
        .catch(e => reject(e));
    }
  });
}

// https://dev.adzerk.com/reference/site#list-sites
function listSites() {
  return new Promise((resolve, reject) => {
    fetch(`${BASE_URL}/management/v1/site`, { headers: COMMON_HEADERS })
      .then(response => response.json())
      .then(data => resolve(data.items.sort((a, b) => a.Title.localeCompare(b.Title))))
      .catch(e => reject(e));
  });
}

function requestData() {
  const startTimeEl = document.getElementById('start-time');
  const endTimeEl = document.getElementById('end-time');
  const siteId = document.getElementById('site').value.match(/^([0-9]+):/)[1];

  return {
    GroupBy: ['campaignId'],
    StartDateISO: `${startTimeEl.value}T00:00:00`,
    EndDateISO: `${endTimeEl.value}T00:00:00`,
    Parameters: [{ siteId: siteId }],
  }
}

// https://dev.adzerk.com/v1.0/reference/queued-reports#create-queued-report
function createQueuedReport() {
  return new Promise((resolve, reject) => {
    const headers = {
      'X-Adzerk-ApiKey': COMMON_HEADERS['X-Adzerk-ApiKey'],
      'Content-Type': 'application/json'
    }

    // console.log(requestData());

    fetch(`${BASE_URL}/reporting/v1/queue`, { method: 'POST', headers, body: JSON.stringify(requestData()) })
      .then(response => response.json())
      .then(data => resolve(data))
      .catch(e => reject(e));
  });
}

// https://dev.adzerk.com/v1.0/reference/queued-reports#poll-for-queued-report-result
function _getReport(reportId) {
  return new Promise((resolve, reject) => {
      fetch(`${BASE_URL}/reporting/v1/queue/${reportId}`, { headers: COMMON_HEADERS })
        .then(response => response.json())
        .then(data => resolve(data))
        .catch(e => reject(e));
  });
}

async function getReport(reportId) {
  return new Promise((resolve, reject) => {
    (async function waitForReport() {
      const report = await _getReport(reportId);

      if (CANCEL_REPORT) {
        CANCEL_REPORT = false;
        resolve();
      } else if (report.Status === 3) {
        console.log('Report error');
        reject();
      } else if (report.Status === 2) {
        console.log('Report ready; returning report');
        resolve(report.Result);
      } else {
        console.log('Report not ready; waiting to try again.');
        setTimeout(waitForReport, 1000);
      }
    })();
  });
}

function cancelReport() {
  if (document.getElementById('generate-report').disabled) {
    CANCEL_REPORT = true;
    const createReportEl = document.getElementById('generate-report');
    createReportEl.value = 'Canceling…';
  }
}

async function loadReport(report) {
  document.getElementById('report-placeholder').style.display = 'none';
  document.getElementById('report-result').style.display = 'table';
  document.getElementById('report-download').style.display = 'block';
  document.getElementById('report-copy').style.display = 'block';
  const body = document.getElementById('report-result-body');
  const footer = document.getElementById('report-result-footer');
  body.innerHTML = footer.innerHTML = '';

  for (const record of report.Records) {
    for (const details of record.Details) {
      const campaignName = details.Grouping.CampaignId ? (await getMeta('campaign', details.Grouping.CampaignId)).Name : '';

      const tr = body.appendChild(document.createElement('tr'));
      tr.appendChild(document.createElement('td')).innerHTML = campaignName;
      tr.appendChild(document.createElement('td')).innerHTML = details.Impressions.toLocaleString();
    }
  }

  const tr = footer.appendChild(document.createElement('tr'));
  tr.appendChild(document.createElement('td'));
  tr.appendChild(document.createElement('td')).innerHTML = report.TotalImpressions.toLocaleString();

  Array.from(document.querySelectorAll('#report-result tbody tr td')).forEach(td =>{
    td.addEventListener('click', copyTableColumn);
    td.addEventListener('mouseover', columnHighlight);
    td.addEventListener('mouseout', clearColumnHighlight);
  });

  Array.from(document.querySelectorAll('#report-result tfoot tr td')).forEach(td =>{
    td.addEventListener('click', copyTableCell);
  });
}

function columnHighlight(e) {
  e.preventDefault();
  const columnIndex = Array.from(e.target.parentNode.children).indexOf(e.target);
  Array.from(document.querySelectorAll(`#report-result tbody td:nth-child(${columnIndex + 1})`)).forEach(td => {
    td.classList.add('hi');
  });
}

function clearColumnHighlight(e) {
  e.preventDefault();
  Array.from(document.querySelectorAll('#report-result .hi')).forEach(td =>{
    td.classList.remove('hi');
  })
}


async function generateReport(e) {
  e.preventDefault();

  if (requestData().Parameters.length) {
    const createReportEl = document.getElementById('generate-report');
    const label = createReportEl.value;

    createReportEl.disabled = true;
    createReportEl.value = 'Waiting for Adzerk (⎋ to cancel)';
    createReportEl.classList.add('working');

    loadReport(await getReport((await createQueuedReport()).Id));

    createReportEl.disabled = false;
    createReportEl.value = label;
    createReportEl.classList.remove('working');
  }
}

function downloadReport() {
  if (document.getElementById('report-result').style.display === 'table') {
    const csv = Array.from(document.querySelectorAll('#report-result tr')).map(row => {
      return Array.from(row.querySelectorAll('th,td')).map(c => `"${c.innerHTML.replace(/"/g, '""')}"`).join(',')
    }).join('\n')

    anchor = document.createElement('a');
    anchor.setAttribute('href', encodeURI(`data:text/csv;charset=utf-8,${csv}`));
    anchor.setAttribute('download', `${document.getElementById('site').value} - ${+(new Date())}.csv`);
    anchor.click();
  }
}

function copyReport() {
  if (document.getElementById('report-result').style.display === 'table') {
    const tsv = Array.from(document.querySelectorAll('#report-result tr')).map(row => {
      return Array.from(row.querySelectorAll('th,td')).map(c => c.innerHTML).join('\t')
    }).join('\n')
    copy(tsv);
  }
}

function copyTableColumn(e) {
  e.preventDefault();

  const columnIndex = Array.from(e.target.parentNode.children).indexOf(e.target);
  const values = Array.from(document.querySelectorAll(`#report-result tbody td:nth-child(${columnIndex + 1})`)).map(c => c.innerText);

  copy(values.join('\n'));
}

function copyTableCell(e) {
  copy(e.target.innerText);
}

function copy(text) {
  const el = document.createElement('textarea');
  document.getElementById('void').appendChild(el);
  el.textContent = text;

  window.getSelection().removeAllRanges();
  el.select();
  document.execCommand('copy');
  document.getElementById('void').removeChild(el);
}

function hotkeys(e) {
  if (e.metaKey && e.key === 'k') {
    e.preventDefault(); document.getElementById('site').focus();
  } else if (e.metaKey && e.key === 'g') {
    e.preventDefault(); document.getElementById('generate-report').click();
  } else if (e.metaKey && e.shiftKey && e.key === 'd') {
    e.preventDefault(); copyReport();
  } else if (e.metaKey && e.key === 'd') {
    e.preventDefault(); downloadReport();
  } else if (e.metaKey && e.key === 'l') {
    e.preventDefault(); toggleDateGuesser();
  } else if (e.key === 'Escape') {
    cancelReport();
  }
}


(async function () {
  document.addEventListener('DOMContentLoaded', async (_) => {
    COMMON_HEADERS['X-Adzerk-ApiKey'] = window.location.search.match(/k=([a-zA-Z0-9]+)/)[1];
    if (COMMON_HEADERS['X-Adzerk-ApiKey']) { document.getElementById('key-error').style.display = 'none'; }

    const href = document.getElementById('switch-mode-a').getAttribute('href');
    const key = window.location.search.match(/k=([a-zA-Z0-9]+)/)[1];
    document.getElementById('switch-mode-a').setAttribute('href', `${href}${key}`);

    document.onkeydown = hotkeys;
    document.getElementById('generate-report').addEventListener('click', generateReport);
    document.getElementById('report-download').addEventListener('click', downloadReport);
    document.getElementById('report-copy').addEventListener('click', copyReport);
    Array.from(document.querySelectorAll('#report-result th')).forEach(h => h.addEventListener('click', copyTableColumn));

    // Get the list of sites and load it into the data list
    const siteListEl = document.getElementById('site-list');
    siteListEl.sites = await listSites();
    for (const site of siteListEl.sites) {
      const optionEl = document.createElement('option');
      optionEl.innerHTML = `${site.Id}: ${site.Title}`;
      siteListEl.appendChild(optionEl);
    }
  });
})();
