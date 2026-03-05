const axios = require('axios');

class TeamsService {
  constructor() {
    this.webhookUrl = null;
    this.initialized = false;
  }

  initialize() {
    this.webhookUrl = process.env.TEAMS_WEBHOOK_URL;

    if (!this.webhookUrl) {
      console.warn('⚠️  MS Teams integration not configured. Missing TEAMS_WEBHOOK_URL.');
      return false;
    }

    this.initialized = true;
    console.log('✅ MS Teams webhook integration initialized');
    return true;
  }

  isConfigured() {
    return this.initialized;
  }

  /**
   * Format issues into a simple MessageCard for Teams (O365 Connector format)
   */
  formatMessageCard(issuesByUser, sprintName) {
    const sections = [];

    for (const [userName, data] of Object.entries(issuesByUser)) {
      const facts = data.issues.map(issue => ({
        name: `[${issue.key}](https://${process.env.JIRA_DOMAIN}/browse/${issue.key})`,
        value: `${issue.summary}<br/>⚠️ ${issue.warnings.join(', ')}`
      }));

      sections.push({
        activityTitle: `👤 ${userName}`,
        activitySubtitle: `${data.issues.length} issue(s) need attention`,
        facts: facts,
        markdown: true
      });
    }

    // O365 Connector Card format (MessageCard)
    return {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: 'DC2626',
      summary: `Sprint Readiness Alert - ${sprintName}`,
      sections: [
        {
          activityTitle: '🚨 Sprint Readiness Alert',
          activitySubtitle: `Sprint: ${sprintName}`,
          activityImage: 'https://cdn-icons-png.flaticon.com/512/5968/5968875.png',
          facts: [
            {
              name: 'Total Issues',
              value: Object.values(issuesByUser).reduce((sum, u) => sum + u.issues.length, 0).toString()
            },
            {
              name: 'Users Affected',
              value: Object.keys(issuesByUser).length.toString()
            }
          ],
          markdown: true
        },
        ...sections
      ]
    };
  }

  /**
   * Format issues into Adaptive Card for a SINGLE user with @mention
   */
  formatUserCard(userName, email, issues, sprintName) {
    const mentionTag = email ? `<at>${userName}</at>` : `**${userName}**`;
    
    const bodyItems = [
      {
        type: 'TextBlock',
        text: '🚨 Sprint Readiness Alert',
        weight: 'bolder',
        size: 'large',
        wrap: true
      },
      {
        type: 'TextBlock',
        text: `Sprint: ${sprintName}`,
        spacing: 'small',
        wrap: true
      },
      {
        type: 'TextBlock',
        text: `👤 ${mentionTag} - ${issues.length} issue(s) need attention`,
        weight: 'bolder',
        spacing: 'medium',
        wrap: true
      }
    ];

    // Add each issue
    for (const issue of issues) {
      bodyItems.push({
        type: 'TextBlock',
        text: `• [${issue.key}](https://${process.env.JIRA_DOMAIN}/browse/${issue.key}): ${issue.summary}`,
        wrap: true,
        spacing: 'small'
      });
      bodyItems.push({
        type: 'TextBlock',
        text: `   ⚠️ ${issue.warnings.join(', ')}`,
        color: 'attention',
        size: 'small',
        wrap: true,
        spacing: 'none'
      });
    }

    const card = {
      type: 'message',
      attachments: [
        {
          contentType: 'application/vnd.microsoft.card.adaptive',
          content: {
            type: 'AdaptiveCard',
            version: '1.2',
            body: bodyItems
          }
        }
      ]
    };

    // Add mention if we have email
    if (email) {
      card.attachments[0].content.msteams = {
        entities: [
          {
            type: 'mention',
            text: `<at>${userName}</at>`,
            mentioned: {
              id: email,
              name: userName
            }
          }
        ]
      };
    }

    return card;
  }

  /**
   * Send notification via webhook - sends INDIVIDUAL cards per user
   */
  async sendWebhookNotification(issuesWithWarnings, sprintName) {
    if (!this.initialized) {
      return { success: false, error: 'Teams webhook not configured' };
    }

    if (issuesWithWarnings.length === 0) {
      return { success: true, message: 'No issues to notify about' };
    }

    // Group issues by assignee, including email for @mentions
    const issuesByUser = {};

    for (const item of issuesWithWarnings) {
      const userName = item.issue.assignee?.displayName || 'Unassigned';
      const email = item.issue.assignee?.emailAddress || null;

      if (!issuesByUser[userName]) {
        issuesByUser[userName] = { email, issues: [] };
      }

      issuesByUser[userName].issues.push({
        key: item.issue.key,
        summary: item.issue.summary,
        warnings: item.warnings
      });
    }

    const userCount = Object.keys(issuesByUser).length;
    let successCount = 0;
    let failCount = 0;
    const errors = [];

    // Send individual card for each user
    for (const [userName, data] of Object.entries(issuesByUser)) {
      try {
        const userCard = this.formatUserCard(userName, data.email, data.issues, sprintName);
        console.log(`Sending individual card for ${userName}...`);
        
        const response = await axios.post(this.webhookUrl, userCard, {
          headers: { 'Content-Type': 'application/json' }
        });
        
        console.log(`Teams response for ${userName}:`, response.status);
        successCount++;
        
        // Small delay between messages to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Failed to send card for ${userName}:`, error.response?.data || error.message);
        failCount++;
        errors.push(`${userName}: ${error.response?.data?.message || error.message}`);
      }
    }

    if (successCount > 0) {
      return {
        success: true,
        message: `Sent ${successCount} individual card(s) to Teams channel. ${failCount > 0 ? `${failCount} failed.` : ''}`
      };
    } else {
      return {
        success: false,
        error: `Failed to send all ${userCount} cards. Errors: ${errors.join('; ')}`
      };
    }
  }

  /**
   * Send notifications to Teams channel about non-ready issues
   */
  async notifyUsersAboutIssues(issuesWithWarnings, sprintName) {
    return this.sendWebhookNotification(issuesWithWarnings, sprintName);
  }
}

module.exports = new TeamsService();
