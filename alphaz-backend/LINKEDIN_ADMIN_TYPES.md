# LinkedIn Organization Admin Types

## How LinkedIn Admin Access Works

There are two ways you can be an admin of a LinkedIn Company Page:

1. **Creator/Owner**: You created the company page
   - You're automatically an ADMINISTRATOR
   - The page is directly linked to your account

2. **Added Admin**: Someone else added you as an admin
   - You have ADMINISTRATOR role but didn't create the page
   - You were invited and accepted the admin role

## API Behavior

When using the Organization ACLs API (`/rest/organizationAcls?q=roleAssignee`), LinkedIn should return:

- ALL organizations where you have ADMINISTRATOR role
- This includes both pages you created AND pages where you were added as admin
- The `state` should be "APPROVED" for active admin access

## Common Issues

1. **Missing Organizations**: If you're not seeing organizations where you were added as admin:
   - Check if the invitation was properly accepted
   - Verify the role state is "APPROVED" not "REQUESTED"
   - Check if there's pagination (multiple pages of results)

2. **API Response Fields**: The organization URN might be in different fields:
   - `organization`: Newer API responses
   - `organizationTarget`: Some API versions
   - Always check both fields

3. **Permissions**: Ensure your app has the `rw_organization_admin` scope to see all admin relationships

## Debugging Steps

1. Check LinkedIn UI to confirm you have admin access to the organizations
2. Look at the raw API response to see all ACLs returned
3. Verify pagination is handled (some users might admin many pages)
4. Check if the organization was recently added (might have sync delay)