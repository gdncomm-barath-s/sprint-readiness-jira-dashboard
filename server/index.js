const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const config = require('./config');
const teamsService = require('./teamsService');

// Helper function to extract value from custom fields (handles select fields with 'value' property)
function getFieldValue(field) {
  if (!field) return null;
  // If it's an object with a 'value' property (select field)
  if (typeof field === 'object' && field.value !== undefined) {
    return field.value;
  }
  // If it's a simple value (string, date, etc.)
  return field;
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Jira API configuration
const JIRA_DOMAIN = process.env.JIRA_DOMAIN;
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;

// Validate environment variables
if (!JIRA_DOMAIN || !JIRA_EMAIL || !JIRA_API_TOKEN) {
  console.error('Missing required environment variables:');
  console.error('- JIRA_DOMAIN:', JIRA_DOMAIN ? '✓' : '✗');
  console.error('- JIRA_EMAIL:', JIRA_EMAIL ? '✓' : '✗');
  console.error('- JIRA_API_TOKEN:', JIRA_API_TOKEN ? '✓' : '✗');
  console.error('\nPlease create a .env file with these variables.');
}

// Create axios instance for Jira API
const jiraApi = axios.create({
  baseURL: `https://${JIRA_DOMAIN}`,
  headers: {
    'Authorization': `Basic ${Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64')}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    configured: !!(JIRA_DOMAIN && JIRA_EMAIL && JIRA_API_TOKEN),
    jiraDomain: JIRA_DOMAIN || null
  });
});

// Get all Scrum boards
app.get('/api/boards', async (req, res) => {
  try {
    const response = await jiraApi.get('/rest/agile/1.0/board', {
      params: {
        type: 'scrum',
        maxResults: 100
      }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching boards:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch boards',
      details: error.response?.data || error.message
    });
  }
});

// Get sprints for a board
app.get('/api/boards/:boardId/sprints', async (req, res) => {
  try {
    const { boardId } = req.params;
    const { state } = req.query;
    
    const params = {
      maxResults: 100
    };
    
    // Filter by sprint state if provided (active, future, closed)
    if (state) {
      params.state = state;
    }
    
    const response = await jiraApi.get(`/rest/agile/1.0/board/${boardId}/sprint`, {
      params
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching sprints:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch sprints',
      details: error.response?.data || error.message
    });
  }
});

// Get issues for a sprint
app.get('/api/sprints/:sprintId/issues', async (req, res) => {
  try {
    const { sprintId } = req.params;
    const { maxResults = 100, startAt = 0 } = req.query;
    
    // Build fields list including custom fields from config
    const fields = [
      'summary',
      'status',
      'assignee',
      'issuetype',
      'priority',
      'created',
      'updated',
      'duedate',
      'labels',
      'components',
      'timetracking',
      'parent',
      config.customFields.storyPoints,
      config.customFields.completionCriteria,
      config.customFields.webLiveDate,
      config.customFields.devPic
    ].join(',');
    
    const response = await jiraApi.get(`/rest/agile/1.0/sprint/${sprintId}/issue`, {
      params: {
        maxResults: parseInt(maxResults),
        startAt: parseInt(startAt),
        fields: fields
      }
    });
    
    // Transform the response to include all needed fields
    const issues = response.data.issues.map(issue => ({
      id: issue.id,
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status,
      assignee: issue.fields.assignee,
      issueType: issue.fields.issuetype,
      priority: issue.fields.priority,
      created: issue.fields.created,
      updated: issue.fields.updated,
      labels: issue.fields.labels || [],
      components: issue.fields.components || [],
      timeTracking: issue.fields.timetracking || null,
      parent: issue.fields.parent ? {
        id: issue.fields.parent.id,
        key: issue.fields.parent.key,
        summary: issue.fields.parent.fields?.summary
      } : null,
      storyPoints: issue.fields[config.customFields.storyPoints] || null,
      // Handle select fields (objects with 'value') and text/date fields
      completionCriteria: getFieldValue(issue.fields[config.customFields.completionCriteria]),
      webLiveDate: getFieldValue(issue.fields[config.customFields.webLiveDate]),
      // Dev PIC can be a user object or text
      devPic: issue.fields[config.customFields.devPic] || null,
      // Due date (standard Jira field)
      dueDate: issue.fields.duedate || null
    }));
    
    res.json({
      issues,
      total: response.data.total,
      maxResults: response.data.maxResults,
      startAt: response.data.startAt
    });
  } catch (error) {
    console.error('Error fetching sprint issues:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch sprint issues',
      details: error.response?.data || error.message
    });
  }
});

// Get a single issue details
app.get('/api/issues/:issueKey', async (req, res) => {
  try {
    const { issueKey } = req.params;
    
    const response = await jiraApi.get(`/rest/api/3/issue/${issueKey}`, {
      params: {
        fields: 'summary,status,assignee,issuetype,priority,description,created,updated,labels,comment'
      }
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching issue:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch issue',
      details: error.response?.data || error.message
    });
  }
});

// Get all Jira fields (for discovering custom field IDs)
app.get('/api/fields', async (req, res) => {
  try {
    const { search } = req.query;
    
    const response = await jiraApi.get('/rest/api/3/field');
    
    let fields = response.data;
    
    // Filter by search term if provided
    if (search) {
      const searchLower = search.toLowerCase();
      fields = fields.filter(field => 
        field.name.toLowerCase().includes(searchLower) ||
        field.id.toLowerCase().includes(searchLower)
      );
    }
    
    // Return simplified field info
    const simplifiedFields = fields.map(field => ({
      id: field.id,
      name: field.name,
      custom: field.custom,
      schema: field.schema
    }));
    
    res.json({
      total: simplifiedFields.length,
      fields: simplifiedFields
    });
  } catch (error) {
    console.error('Error fetching fields:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch fields',
      details: error.response?.data || error.message
    });
  }
});

// Update labels for an issue
app.put('/api/issues/:issueKey/labels', async (req, res) => {
  try {
    const { issueKey } = req.params;
    const { labels } = req.body;
    
    if (!Array.isArray(labels)) {
      return res.status(400).json({ error: 'Labels must be an array' });
    }
    
    await jiraApi.put(`/rest/api/3/issue/${issueKey}`, {
      fields: {
        labels: labels
      }
    });
    
    res.json({ success: true, message: 'Labels updated successfully' });
  } catch (error) {
    console.error('Error updating labels:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to update labels',
      details: error.response?.data || error.message
    });
  }
});

// Add label to an issue (append)
app.post('/api/issues/:issueKey/labels', async (req, res) => {
  try {
    const { issueKey } = req.params;
    const { label } = req.body;
    
    if (!label) {
      return res.status(400).json({ error: 'Label is required' });
    }
    
    // Use the update operation to add a label
    await jiraApi.put(`/rest/api/3/issue/${issueKey}`, {
      update: {
        labels: [{ add: label }]
      }
    });
    
    res.json({ success: true, message: 'Label added successfully' });
  } catch (error) {
    console.error('Error adding label:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to add label',
      details: error.response?.data || error.message
    });
  }
});

// ============ MS Teams Integration (Webhook) ============

// Check Teams integration status
app.get('/api/teams/status', (req, res) => {
  res.json({
    configured: teamsService.isConfigured(),
    message: teamsService.isConfigured() 
      ? 'MS Teams webhook is ready' 
      : 'MS Teams not configured. Add TEAMS_WEBHOOK_URL to .env file.'
  });
});

// Send notifications to Teams channel about non-ready issues
app.post('/api/teams/notify', async (req, res) => {
  try {
    const { issues, sprintName } = req.body;
    
    if (!teamsService.isConfigured()) {
      return res.status(400).json({
        success: false,
        error: 'MS Teams webhook not configured. Add TEAMS_WEBHOOK_URL to your .env file.'
      });
    }
    
    if (!issues || !Array.isArray(issues)) {
      return res.status(400).json({ error: 'Issues array is required' });
    }
    
    const result = await teamsService.notifyUsersAboutIssues(issues, sprintName || 'Current Sprint');
    res.json(result);
  } catch (error) {
    console.error('Error sending Teams notification:', error.message);
    res.status(500).json({
      error: 'Failed to send Teams notification',
      details: error.message
    });
  }
});

// Initialize Teams service
teamsService.initialize();

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Jira Dashboard API server running on http://localhost:${PORT}`);
  console.log(`📋 Jira Domain: ${JIRA_DOMAIN || 'NOT CONFIGURED'}`);
});
