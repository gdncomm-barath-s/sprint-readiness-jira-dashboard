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
