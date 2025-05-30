// src/routes/engage/settings/workspace/people/+page.server.ts
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import { userWorkspaces, users, workspaces, userInvites } from '$lib/db/drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { randomUUID } from 'crypto';

export const load: PageServerLoad = async ({ locals, url, cookies, request }) => {
  // Ensure user is authenticated
  if (!locals.user) {
    redirect(303, '/login');
  }

  // Get the current workspace ID from locals
  const workspaceId = locals.currentWorkspace?.id;
  
  if (!workspaceId) {
    console.error('No workspace ID found in server component, checking query parameter');
    
    // Get workspace ID from the URL query parameter as fallback
    const urlWorkspaceId = url.searchParams.get('workspace');
    
    if (urlWorkspaceId) {
      console.log(`Using workspace ID from URL: ${urlWorkspaceId}`);
      // Set it in locals for future requests
      locals.currentWorkspace = { id: urlWorkspaceId } as any;
      // Continue with this workspace ID
      return load({ locals: { ...locals, currentWorkspace: { id: urlWorkspaceId } }, url, cookies, request });
    }
    
    // Return an empty state that the client will handle
    return {
      members: [],
      pendingInvites: [],
      workspace: null,
      workspaceRoles: ['Super Admin', 'Admin', 'Basic User', 'Volunteer'],
      noWorkspaceSelected: true
    };
  }
  
  try {
    console.log(`Loading workspace members for workspace ID: ${workspaceId}`);
    
    // Add debugging here
    console.log('Checking access for workspaceId:', workspaceId, 'and userId:', locals.user.id);
    console.log('Locals object:', JSON.stringify(locals, null, 2));
    
    // Check if the user has permission to access this workspace
    let userWorkspace = null;
    try {
      const results = await db.select()
        .from(userWorkspaces)
        .where(and(
          eq(userWorkspaces.userId, locals.user.id),
          eq(userWorkspaces.workspaceId, workspaceId)
        ))
        .limit(1);
        
      userWorkspace = results[0];
      
      // Log the result of the lookup
      console.log('User workspace lookup result:', userWorkspace);
    } catch (err) {
      console.error('Error checking workspace access:', err);
    }
    
    if (!userWorkspace) {
      console.error(`User ${locals.user.id} does not have access to workspace ${workspaceId}`);
      return {
        members: [],
        pendingInvites: [],
        workspace: null,
        workspaceRoles: ['Super Admin', 'Admin', 'Basic User', 'Volunteer'],
        noWorkspaceAccess: true
      };
    }
    
    // Get workspace members
    let members = [];
    try {
      const results = await db.select()
        .from(userWorkspaces)
        .leftJoin(users, eq(userWorkspaces.userId, users.id))
        .where(eq(userWorkspaces.workspaceId, workspaceId));
        
      members = results.map(row => ({
        id: row.user_workspaces.id,
        userId: row.user_workspaces.userId,
        workspaceId: row.user_workspaces.workspaceId,
        role: row.user_workspaces.role,
        createdAt: row.user_workspaces.createdAt,
        updatedAt: row.user_workspaces.updatedAt,
        user: {
          id: row.users.id,
          email: row.users.email,
          username: row.users.username,
          displayName: row.users.displayName,
          avatar: row.users.avatar
        }
      }));
    } catch (err) {
      console.error('Error fetching workspace members:', err);
    }
    
    console.log(`Found ${members.length} members for workspace ${workspaceId}`);
    
    // Format dates to ISO strings
    members = members.map(member => ({
      ...member,
      createdAt: member.createdAt instanceof Date ? member.createdAt.toISOString() : member.createdAt,
      updatedAt: member.updatedAt instanceof Date ? member.updatedAt.toISOString() : member.updatedAt,
    }));
    
    // Initialize pendingInvites as an empty array
    let pendingInvites = [];
    let tableNotReady = false;
    
    // Get pending invites for this workspace if userInvites is defined
    try {
      if (userInvites) {
        pendingInvites = await db.query.userInvites.findMany({
          where: and(
            eq(userInvites.workspaceId, workspaceId),
            eq(userInvites.status, 'Pending')
          ),
          with: {
            invitedBy: {
              columns: {
                id: true,
                username: true,
                displayName: true,
                email: true,
                avatar: true
              }
            }
          }
        });
        
        console.log(`Found ${pendingInvites.length} pending invites for workspace ${workspaceId}`);
      } else {
        console.warn('userInvites table is not defined - skipping pending invites query');
        pendingInvites = [];
      }
    } catch (err) {
      console.error('Error fetching pending invites:', err);
      pendingInvites = [];
    }
    
    // Lookup workspace name for the breadcrumb
    let workspace = null;
    try {
      const results = await db.select()
        .from(workspaces)
        .where(eq(workspaces.id, workspaceId))
        .limit(1);
        
      workspace = results[0];
    } catch (err) {
      console.error('Error fetching workspace details:', err);
    }
    
    return {
      members,
      pendingInvites,
      workspace,
      workspaceRoles: ['Super Admin', 'Admin', 'Basic User', 'Volunteer']
    };
  } catch (err) {
    console.error('Error loading workspace people:', err);
    
    // Return basic error data
    return {
      members: [],
      pendingInvites: [],
      workspace: null,
      workspaceRoles: ['Super Admin', 'Admin', 'Basic User', 'Volunteer'],
      error: 'Could not load workspace members'
    };
    
    throw error(500, 'Failed to load workspace members');
  }
};

export const actions: Actions = {
  inviteUser: async ({ request, locals }) => {
    if (!locals.user) {
      throw error(401, 'You must be logged in to invite users');
    }
    
    const workspaceId = locals.currentWorkspace?.id;
    
    if (!workspaceId) {
      throw error(400, 'No workspace selected');
    }
    
    // Parse form data
    const formData = await request.formData();
    const email = formData.get('email')?.toString().toLowerCase();
    const role = formData.get('role')?.toString();
    
    if (!email || !role) {
      throw error(400, 'Email and role are required');
    }
    
    try {
      // Simplified temporary version for inviting users
      // Check if the user already exists
      try {
      const existingUserResults = await db.select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

      const existingUser = existingUserResults[0];

      if (existingUser) {
      // Check if user is already in the workspace
      const existingMemberResults = await db.select()
      .from(userWorkspaces)
      .where(and(
          eq(userWorkspaces.userId, existingUser.id),
        eq(userWorkspaces.workspaceId, workspaceId)
      ))
        .limit(1);

      const existingMember = existingMemberResults[0];
      
        if (existingMember) {
            throw error(400, 'This user is already a member of this workspace');
        }
        
        // Add the user directly to the workspace
      await db.insert(userWorkspaces).values({
          userId: existingUser.id,
          workspaceId,
            role
          });
          
          return {
            success: true,
          message: 'User added to workspace',
        userAdded: true
      };
      } else {
        // User doesn't exist, return a message
      return {
          success: false,
            message: 'User not found. Please ask them to sign up first.'
        };
        }
      } catch (err) {
        console.error('Error in invite user process:', err);
      if (err instanceof Error && 'status' in err) {
        throw err; // Re-throw SvelteKit error objects
      }
      throw error(500, 'Failed to process invitation. Please try again later.');
      }
    } catch (err) {
      if (err instanceof Error && 'status' in err) {
        throw err;
      }
      console.error('Error inviting user:', err);
      throw error(500, err instanceof Error ? err.message : 'Failed to send invitation');
    }
  },
  
  removeUser: async ({ request, locals }) => {
    if (!locals.user) {
      throw error(401, 'You must be logged in to remove users');
    }
    
    const workspaceId = locals.currentWorkspace?.id;
    
    if (!workspaceId) {
      throw error(400, 'No workspace selected');
    }
    
    try {
      // Parse form data
      const formData = await request.formData();
      const userId = formData.get('userId')?.toString();
      
      if (!userId) {
        throw error(400, 'User ID is required');
      }
      
      // Don't allow removing self
      if (userId === locals.user.id) {
        throw error(400, 'You cannot remove yourself from the workspace');
      }
      
      // Get the user's workspace relationship
      const userWorkspaceResults = await db.select()
        .from(userWorkspaces)
        .where(and(
          eq(userWorkspaces.userId, userId),
          eq(userWorkspaces.workspaceId, workspaceId)
        ))
        .limit(1);
      
      const userWorkspace = userWorkspaceResults[0];
      
      if (!userWorkspace) {
        throw error(404, 'User not found in this workspace');
      }
      
      // Delete the relationship
      await db.delete(userWorkspaces)
        .where(eq(userWorkspaces.id, userWorkspace.id));
      
      return {
        success: true,
        message: 'User removed from workspace'
      };
    } catch (err) {
      if (err instanceof Error && 'status' in err) {
        throw err;
      }
      console.error('Error removing user:', err);
      throw error(500, err instanceof Error ? err.message : 'Failed to remove user');
    }
  },
  
  cancelInvite: async ({ request, locals }) => {
    if (!locals.user) {
      throw error(401, 'You must be logged in to cancel invites');
    }
    
    const workspaceId = locals.currentWorkspace?.id;
    
    if (!workspaceId) {
      throw error(400, 'No workspace selected');
    }
    
    try {
      // Parse form data
      const formData = await request.formData();
      const inviteId = formData.get('inviteId')?.toString();
      
      if (!inviteId) {
        throw error(400, 'Invite ID is required');
      }
      
      // For now, just return a message since we're not using user_invites
      return {
        success: true,
        message: 'The invite system is currently unavailable. Please try again later.'
      };
    } catch (err) {
      if (err instanceof Error && 'status' in err) {
        throw err;
      }
      console.error('Error cancelling invite:', err);
      throw error(500, err instanceof Error ? err.message : 'Failed to cancel invitation');
    }
  },
  
  updateRole: async ({ request, locals }) => {
    if (!locals.user) {
      throw error(401, 'You must be logged in to update roles');
    }
    
    const workspaceId = locals.currentWorkspace?.id;
    
    if (!workspaceId) {
      throw error(400, 'No workspace selected');
    }
    
    try {
      // Parse form data
      const formData = await request.formData();
      const userWorkspaceId = formData.get('userWorkspaceId')?.toString();
      const role = formData.get('role')?.toString();
      
      if (!userWorkspaceId || !role) {
        throw error(400, 'User workspace ID and role are required');
      }
      
      // Get the user workspace relationship
      const relationshipsResults = await db.select()
        .from(userWorkspaces)
        .where(and(
          eq(userWorkspaces.id, userWorkspaceId),
          eq(userWorkspaces.workspaceId, workspaceId)
        ))
        .limit(1);
      
      const relationship = relationshipsResults[0];
      
      if (!relationship) {
        throw error(404, 'User not found in this workspace');
      }
      
      // Get user information
      const userResults = await db.select()
        .from(users)
        .where(eq(users.id, relationship.userId))
        .limit(1);
        
      const user = userResults[0];
      
      // Don't allow super admins to downgrade themselves
      if (user && user.id === locals.user.id && relationship.role === 'Super Admin' && role !== 'Super Admin') {
        throw error(400, 'You cannot downgrade your own Super Admin role');
      }
      
      // Update the role
      await db.update(userWorkspaces)
        .set({ role })
        .where(eq(userWorkspaces.id, userWorkspaceId));
      
      return {
        success: true,
        message: 'Role updated'
      };
    } catch (err) {
      if (err instanceof Error && 'status' in err) {
        throw err;
      }
      console.error('Error updating role:', err);
      throw error(500, err instanceof Error ? err.message : 'Failed to update role');
    }
  }
};
