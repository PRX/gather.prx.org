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

// https://dev.adzerk.com/v1.0/reference/advertiser#get-advertisers
function listAdvertisers() {
  return new Promise((resolve, reject) => {
    fetch(`${BASE_URL}/management/v1/advertiser`, { headers: COMMON_HEADERS })
      .then(response => response.json())
      .then(data => resolve(data.items.sort((a, b) => a.Title.localeCompare(b.Title))))
      .catch(e => reject(e));
  });
}

// Get the list of all campaigns for a given advertiser from the Adzerk
// management API.
// https://dev.adzerk.com/v1.0/reference/campaign#list-campaigns
function listAdvertiserCampaigns(advertiserId) {
  return new Promise((resolve, reject) => {
    fetch(`${BASE_URL}/management/v1/campaign?AdvertiserId=${advertiserId}`, { headers: COMMON_HEADERS })
      .then(response => response.json())
      .then(data => resolve(data.items.sort((a, b) => a.Name.localeCompare(b.Name))))
      .catch(e => reject(e));
  });
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

function requestData() {
  const startTimeEl = document.getElementById('start-time');
  const endTimeEl = document.getElementById('end-time');
  const campaignsEl = document.getElementById('campaigns');
  const dateGroupEl = document.getElementById('date-group');
  const parameterGroupEl = document.getElementById('parameter-group');

  return {
    GroupBy: (dateGroupEl.value ? [dateGroupEl.value] : []).concat(Array.from(parameterGroupEl.selectedOptions).map(o => o.value)),
    StartDateISO: `${startTimeEl.value}T00:00:00`,
    EndDateISO: `${endTimeEl.value}T00:00:00`,
    Parameters: Array.from(campaignsEl.selectedOptions).map(option => {
      return { campaignId: option.value.match(/^([0-9]+):/)[1] };
    })
  }
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
      const advertiserName = details.Grouping.BrandId ? document.getElementById('advertiser-list').advertisers.find(a => details.Grouping.BrandId === a.Id).Title : '';
      const campaignName = details.Grouping.CampaignId ? document.getElementById('campaigns').campaigns.find(c => details.Grouping.CampaignId === c.Id).Name : '';
      const zoneName = details.Grouping.ZoneId ? (await getMeta('zone', details.Grouping.ZoneId)).Name : '';
      const flightName = details.Grouping.OptionId ? (await getMeta('flight', details.Grouping.OptionId)).Name : '';
      const creativeName = details.Grouping.CreativeId ? (await getMeta('creative', details.Grouping.CreativeId)).Title : '';
      const siteName = details.Grouping.SiteId ? (await getMeta('site', details.Grouping.SiteId)).Title : '';
      const dma = details.Grouping.MetroCode ? details.Grouping.MetroCode : '';
      const metro = details.Grouping.MetroCode ? DMA_CODES[details.Grouping.MetroCode] : '';

      const tr = body.appendChild(document.createElement('tr'));
      tr.appendChild(document.createElement('td')).innerHTML = details.FirstDate.substr(0, 10);
      tr.appendChild(document.createElement('td')).innerHTML = advertiserName;
      tr.appendChild(document.createElement('td')).innerHTML = campaignName;
      tr.appendChild(document.createElement('td')).innerHTML = flightName;
      tr.appendChild(document.createElement('td')).innerHTML = creativeName;
      tr.appendChild(document.createElement('td')).innerHTML = siteName;
      tr.appendChild(document.createElement('td')).innerHTML = zoneName;
      tr.appendChild(document.createElement('td')).innerHTML = details.Grouping.CountryCode ? details.Grouping.CountryCode : '';
      tr.appendChild(document.createElement('td')).innerHTML = dma;
      tr.appendChild(document.createElement('td')).innerHTML = metro;
      tr.appendChild(document.createElement('td')).innerHTML = details.Impressions.toLocaleString();
    }
  }

  const tr = footer.appendChild(document.createElement('tr'));
  tr.appendChild(document.createElement('td'));
  tr.appendChild(document.createElement('td'));
  tr.appendChild(document.createElement('td'));
  tr.appendChild(document.createElement('td'));
  tr.appendChild(document.createElement('td'));
  tr.appendChild(document.createElement('td'));
  tr.appendChild(document.createElement('td'));
  tr.appendChild(document.createElement('td'));
  tr.appendChild(document.createElement('td'));
  tr.appendChild(document.createElement('td'));
  tr.appendChild(document.createElement('td')).innerHTML = report.TotalImpressions;

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

function filterCampaigns(e) {
  if (e && e.key === 'ArrowDown') { e.preventDefault(); document.getElementById('campaigns').focus(); return; }

  const campaignsEl = document.getElementById('campaigns');
  campaignsEl.innerHTML = '';

  document.getElementById('campaigns-filter').value.split(' ').reduce((result, filter) => {
    const re = new RegExp(filter.replace(/\?/g, '\\?'), 'i');
    return (result||[]).filter(c => c.Name.match(re));
  }, campaignsEl.campaigns).forEach(campaign => {
    const optionEl = document.createElement('option');
    optionEl.innerHTML = `${campaign.Id}: ${campaign.Name}`;
    campaignsEl.appendChild(optionEl);
  });
}

function guessDateRange() {
  if (document.getElementById('date-locked').getAttribute('data-value') === '0') {
    const dates = [];

    for (const campaign of Array.from(document.getElementById('campaigns').selectedOptions).map(v=>v.value)) {
      const match = campaign.match(/_(20\d{2})_(\d{4})-(\d{4}|\?{2})_/);

      if (match) {
        const endYear = match[3] < match[2] ? `${(+match[1]) + 1}` : match[1];
        let endMmDd = `${match[3].substr(0,2)}-${match[3].substr(2,2)}`;

        if (match[3] === '??') { endMmDd = `${match[2].substr(0,2)}-${match[2].substr(2,2)}`; }

        dates.push(`${match[1]}-${match[2].substr(0,2)}-${match[2].substr(2,2)}`);
        dates.push(`${endYear}-${endMmDd}`);

        document.getElementById('start-time').value = dates.sort((a, b) => a.localeCompare(b))[0]
        document.getElementById('end-time').value = dates.sort((a, b) => b.localeCompare(a))[0]
      }
    }
  }
}

function toggleDateGuesser() {
  const lock = document.getElementById('date-locked');
  lock.setAttribute('data-value', `${(1 - (+lock.getAttribute('data-value')))}`);
}

async function selectAdvertiser() {
  try {
    const advertiserId = document.getElementById('advertiser').value.match(/^([0-9]+):/)[1];

    const campaignsEl = document.getElementById('campaigns');
    campaignsEl.innerHTML = '';
    campaignsEl.campaigns = await listAdvertiserCampaigns(advertiserId);
    for (const campaign of campaignsEl.campaigns) {
      const optionEl = document.createElement('option');
      optionEl.innerHTML = `${campaign.Id}: ${campaign.Name}`;
      campaignsEl.appendChild(optionEl);
    }

    // document.getElementById('campaigns-filter').value = '';
    filterCampaigns();
    document.getElementById('campaigns-filter').focus();
  } catch (e) {}
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
    anchor.setAttribute('download', `${document.getElementById('advertiser').value} - ${+(new Date())}.csv`);
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
    e.preventDefault(); document.getElementById('advertiser').focus();
  } else if (e.metaKey && e.key === 'g') {
    e.preventDefault(); document.getElementById('generate-report').click();
  } else if (e.metaKey && e.key === 'f') {
    e.preventDefault(); document.getElementById('campaigns-filter').focus();
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

    document.onkeydown = hotkeys;
    document.getElementById('advertiser').addEventListener('change', selectAdvertiser);
    document.getElementById('campaigns-filter').addEventListener('keyup', filterCampaigns);
    document.getElementById('campaigns').addEventListener('input', guessDateRange);
    document.getElementById('generate-report').addEventListener('click', generateReport);
    document.getElementById('report-download').addEventListener('click', downloadReport);
    document.getElementById('report-copy').addEventListener('click', copyReport);
    document.getElementById('date-locked').addEventListener('click', toggleDateGuesser);
    Array.from(document.querySelectorAll('#report-result th')).forEach(h => h.addEventListener('click', copyTableColumn));

    // Get the list of advertisers and load it into the data list
    const advertiserListEl = document.getElementById('advertiser-list');
    advertiserListEl.advertisers = await listAdvertisers();
    for (const advertiser of advertiserListEl.advertisers) {
      const optionEl = document.createElement('option');
      optionEl.innerHTML = `${advertiser.Id}: ${advertiser.Title}`;
      advertiserListEl.appendChild(optionEl);
    }
  });
})();
