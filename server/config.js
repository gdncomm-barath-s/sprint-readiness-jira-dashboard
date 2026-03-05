// Custom field configuration for Jira
// Use the /api/fields endpoint to discover your custom field IDs
// Example: GET http://localhost:3000/api/fields?search=completion

module.exports = {
  customFields: {
    // Story points field (commonly customfield_10016)
    storyPoints: 'customfield_10016',
    
    // Completion Criteria field
    // Found via: /api/fields?search=completion
    completionCriteria: 'customfield_10429',
    
    // Web Live Date field
    // Found via: /api/fields?search=live
    webLiveDate: 'customfield_10068',
    
    // Dev PIC (Person In Charge) field
    // Found via: /api/fields?search=pic or /api/fields?search=dev
    devPic: 'customfield_11438'  // TODO: Update with actual field ID
  },
  
  // Time tracking configuration
  timeTracking: {
    // Hours per day for converting seconds to days
    hoursPerDay: 8
  }
};
