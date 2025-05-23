<!-- src/routes/engage/settings/workspace/people/+page.svelte -->
<script lang="ts">
    import { enhance } from '$app/forms';
    import { userStore } from '$lib/stores/userStore';
    import { toastStore } from '$lib/stores/toastStore';
    import { workspaceStore } from '$lib/stores/workspaceStore';
    import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
    import type { PageData, ActionData } from './$types';
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import { onMount } from 'svelte';
    import { syncCurrentWorkspaceWithServer, reloadPageWithDelay } from '$lib/utils/workspace-sync';
    
    export let data: PageData;
    export let form: ActionData;
    
    $: members = data.members || [];
    $: workspaceId = $workspaceStore.currentWorkspace?.id;
    $: hasMembersLoaded = false;
    $: hasInvitesLoaded = false;
    $: pendingInvites = data.pendingInvites || [];
    $: workspaceRoles = data.workspaceRoles || [];
    $: noWorkspaceSelected = data.noWorkspaceSelected || false;
    $: noWorkspaceAccess = data.noWorkspaceAccess || false;
    // Removed tableNotReady check
    
    // State for invite form
    let showInviteForm = false;
    let inviteEmail = '';
    let inviteRole = 'Basic User';
    let isInviting = false;
    let inviteLink = '';
    
    // Handle action responses
    $: if (form?.success) {
      toastStore.success(form.message);
      
      // Store the invite link if provided
      if (form.inviteLink) {
        inviteLink = form.inviteLink;
      }
      
      // Reset invite form if it was a successful invite
      if (form.message === 'Invitation sent' || form.message === 'User added to workspace') {
        inviteEmail = '';
        showInviteForm = false;
      }
    } else if (form?.error) {
      toastStore.error(form.error);
    }
    
    // Toggle invite form
    function toggleInviteForm() {
      showInviteForm = !showInviteForm;
      if (!showInviteForm) {
        // Reset form when closing
        inviteEmail = '';
        inviteRole = 'Basic User';
        inviteLink = '';
      }
    }
    
    // Copy invite link to clipboard
    function copyInviteLink() {
      navigator.clipboard.writeText(inviteLink)
        .then(() => {
          toastStore.success('Invite link copied to clipboard');
        })
        .catch((err) => {
          console.error('Could not copy text: ', err);
          toastStore.error('Failed to copy invite link');
        });
    }
    
    // Check if the member is the current user
    function isCurrentUser(userId: string) {
      return userId === $userStore.user?.id;
    }
    
    // Format date
    function formatDate(dateStr: string) {
      return new Date(dateStr).toLocaleDateString();
    }
    
    // Submit role update form when value changes
    function handleRoleChange(event: Event) {
      const form = (event.target as HTMLSelectElement).closest('form');
      if (form) form.submit();
    }
    
    // Navigate to the workspaces page
    function navigateToWorkspaces() {
      goto('/app/settings/workspace/general');
    }
    
    // On mount, ensure we have a workspace ID and load data
    onMount(async () => {
      console.log('Component mounted: Checking workspace state');
      // Check if we have a workspace ID in the store
      const currentWorkspace = $workspaceStore.currentWorkspace;
      
      // Add additional debugging
      console.log('Current workspace in store:', currentWorkspace);
      console.log('Local storage workspace ID:', localStorage.getItem('current_workspace_id'));
      
      if (!currentWorkspace && $workspaceStore.workspaces.length > 0) {
        // Set the first workspace as active
        console.log('No current workspace selected, using first available workspace');
        await workspaceStore.setCurrentWorkspace($workspaceStore.workspaces[0].id);
        
        // Wait for the current workspace to be synced to the server
        setTimeout(() => {
          // Force a reload of the page to use the new workspace
          window.location.reload();
        }, 500);
      } else if (currentWorkspace && noWorkspaceSelected) {
        // We have a workspace in the store but the server doesn't know about it
        // This could happen if the cookie wasn't set properly
        console.log('Workspace selected in client but not in server, syncing...');
        
        try {
          // Sync the workspace with the server
          await syncCurrentWorkspaceWithServer();
          
          // Reload the page to use the newly set workspace
          reloadPageWithDelay();
        } catch (error) {
          console.error('Failed to sync workspace with server:', error);
        }
      } else if (currentWorkspace) {
        console.log(`Current workspace: ${currentWorkspace.id} (${currentWorkspace.name})`);
        // If we have a workspace ID, load members from the API
        await fetchWorkspaceMembers(currentWorkspace.id);
        await fetchWorkspaceInvites(currentWorkspace.id);
      } else {
        console.warn('No workspace available. Cannot load members or invites.');
        
        // Attempt to refresh workspaces from the API
        console.log('Refreshing workspaces from API...');
        await workspaceStore.refreshWorkspaces();
        
        // Check again if we have a workspace after refresh
        if ($workspaceStore.currentWorkspace) {
          console.log('Workspace loaded after refresh');
          await syncCurrentWorkspaceWithServer();
          reloadPageWithDelay();
        }
      }
    });
  
  // Function to fetch workspace members from API
  async function fetchWorkspaceMembers(workspaceId) {
    try {
      hasMembersLoaded = false;
      console.log(`Fetching members for workspace: ${workspaceId}`);
      
      const response = await fetch(`/api/workspaces/${workspaceId}/members`);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch members: ${response.status} ${response.statusText}\n${errorText}`);
      }
      
      const result = await response.json();
      console.log('Members API response:', result);
      
      if (result.members) {
        // Update the members list
        members = result.members;
        console.log(`Loaded ${members.length} members`);
      } else {
        console.warn('No members found in API response');
        members = [];
      }
    } catch (error) {
      console.error('Error fetching workspace members:', error);
      toastStore.error('Failed to load workspace members');
      members = []; // Reset on error
    } finally {
      hasMembersLoaded = true;
    }
  }
  
  // Function to fetch workspace invites
  async function fetchWorkspaceInvites(workspaceId) {
    try {
      hasInvitesLoaded = false;
      console.log(`Fetching invites for workspace: ${workspaceId}`);
      
      const response = await fetch(`/api/workspaces/${workspaceId}/invites`);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch invites: ${response.status} ${response.statusText}\n${errorText}`);
      }
      
      const result = await response.json();
      console.log('Invites API response:', result);
      
      if (result.invites) {
        // Update the invites list
        pendingInvites = result.invites;
        console.log(`Loaded ${pendingInvites.length} pending invites`);
      } else {
        console.warn('No invites found in API response');
        pendingInvites = [];
      }
    } catch (error) {
      console.error('Error fetching workspace invites:', error);
      // Don't show error toast for invites as they may not be essential
      pendingInvites = []; // Reset on error
    } finally {
      hasInvitesLoaded = true;
    }
  }
  
  // Watch for workspace changes
  $: if (workspaceId && $workspaceStore.currentWorkspace) {
    if (!hasMembersLoaded) {
      fetchWorkspaceMembers(workspaceId);
    }
    
    if (!hasInvitesLoaded) {
      fetchWorkspaceInvites(workspaceId);
    }
  }
</script>
  
<svelte:head>
  <title>Workspace Members | Engage</title>
</svelte:head>
  
<div class="p-6">
  {#if noWorkspaceSelected}
    <div class="bg-yellow-50 p-8 rounded-lg border border-yellow-200 text-center">
      <svg class="w-16 h-16 mx-auto text-yellow-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
      </svg>
      <h2 class="text-xl font-bold text-yellow-800 mb-2">No Workspace Selected</h2>
      <p class="text-yellow-700 mb-4">Please select a workspace to manage members and invitations.</p>
      <button 
        type="button"
        class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
        on:click={navigateToWorkspaces}
      >
        Select a Workspace
      </button>
    </div>
  {:else if noWorkspaceAccess}
    <div class="bg-red-50 p-8 rounded-lg border border-red-200 text-center">
      <svg class="w-16 h-16 mx-auto text-red-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
      </svg>
      <h2 class="text-xl font-bold text-red-800 mb-2">No Access to This Workspace</h2>
      <p class="text-red-700 mb-4">You don't have permission to access this workspace.</p>
      <button 
        type="button"
        class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
        on:click={navigateToWorkspaces}
      >
        Go to Available Workspaces
      </button>
    </div>
  {:else}
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-xl font-bold">Workspace Members</h2>
      <button
        type="button"
        class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
        on:click={toggleInviteForm}
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="-ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
        Add Member
      </button>
    </div>
      
      <!-- Workspace members are loaded automatically from user_workspaces table -->
      
      <!-- Invite User Form -->
      {#if showInviteForm}
        <div class="bg-gray-50 p-6 rounded-lg border mb-6">
          <h3 class="text-lg font-medium mb-4">Invite New Member</h3>
          
          {#if inviteLink}
            <div class="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
              <h4 class="text-sm font-medium text-blue-800 mb-2">Invitation Created</h4>
              <p class="text-sm text-blue-700 mb-2">Share this link with the user:</p>
              <div class="flex items-center">
                <input
                  type="text"
                  readonly
                  value={inviteLink}
                  class="flex-1 text-sm p-2 border rounded-l-md bg-white"
                />
                <button
                  type="button"
                  class="px-4 py-2 bg-blue-600 text-white rounded-r-md hover:bg-blue-700"
                  on:click={copyInviteLink}
                >
                  Copy
                </button>
              </div>
              <p class="text-xs text-blue-600 mt-2">
                The invite will expire in 7 days. In a production app, we would also send an email.
              </p>
            </div>
          {/if}
          
          <form method="POST" action="?/inviteUser" use:enhance={() => {
            isInviting = true;
            
            return async ({ result, update }) => {
            isInviting = false;
            await update();
              
            // After adding a user, wait a moment then refresh the members list
            setTimeout(async () => {
              if ($workspaceStore.currentWorkspace?.id) {
                await fetchWorkspaceMembers($workspaceStore.currentWorkspace.id);
              }
            }, 500);
          };
          }} class="space-y-4">
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label for="email" class="block text-sm font-medium text-gray-700">Email Address</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  bind:value={inviteEmail}
                  required
                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500"
                  placeholder="colleague@example.com"
                />
              </div>
              <div>
                <label for="role" class="block text-sm font-medium text-gray-700">Role</label>
                <select
                  id="role"
                  name="role"
                  bind:value={inviteRole}
                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500"
                >
                  {#each workspaceRoles as role}
                    <option value={role}>{role}</option>
                  {/each}
                </select>
              </div>
            </div>
            <div class="flex justify-end space-x-3">
              <button
                type="button"
                class="px-4 py-2 border rounded text-gray-700 hover:bg-gray-50"
                on:click={toggleInviteForm}
              >
                Cancel
              </button>
              <button
                type="submit"
                class="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50"
                disabled={isInviting || !inviteEmail}
              >
                {#if isInviting}
                  <div class="flex items-center">
                    <LoadingSpinner size="sm" color="white" />
                    <span class="ml-2">Sending...</span>
                  </div>
                {:else}
                  {#if inviteLink}Create Another Invite{:else}Send Invite{/if}
                {/if}
              </button>
            </div>
          </form>
        </div>
      {/if}
      
      <!-- Members List -->
      <div class="bg-white border rounded-lg overflow-hidden mb-8">
        <div class="px-6 py-4 border-b">
          <h3 class="text-lg font-medium">{$workspaceStore.currentWorkspace ? $workspaceStore.currentWorkspace.name : ''} Members</h3>
        </div>
        
        {#if members.length === 0}
          <div class="text-center py-12 text-gray-500">
            <p>No members found. Invite someone to get started.</p>
          </div>
        {:else}
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Member
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Joined
                </th>
                <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              {#each members as member}
                <tr class="{isCurrentUser(member.user.id) ? 'bg-teal-50' : ''}">
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                      <div class="flex-shrink-0 h-10 w-10">
                        {#if member.user.avatar}
                          <img 
                            src={member.user.avatar} 
                            alt="{member.user.displayName || member.user.username}" 
                            class="h-10 w-10 rounded-full object-cover border border-slate-200"
                          />
                        {:else}
                          <div class="h-10 w-10 rounded-full bg-teal-100 flex items-center justify-center">
                            <span class="text-xl font-medium text-teal-800">
                              {(member.user.displayName?.split(' ')[0]?.[0] || member.user.email?.split('@')[0]?.[0] || member.user.username?.[0] || '?').toUpperCase()}
                            </span>
                          </div>
                        {/if}
                      </div>
                      <div class="ml-4">
                        <div class="text-sm font-medium text-gray-900">
                          {member.user.displayName || member.user.username}
                          {#if isCurrentUser(member.user.id)}
                            <span class="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">
                              You
                            </span>
                          {/if}
                        </div>
                        <div class="text-sm text-gray-500">@{member.user.username}</div>
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-500">{member.user.email}</div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    {#if isCurrentUser(member.user.id)}
                      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {member.role}
                      </span>
                    {:else}
                      <form method="POST" action="?/updateRole" use:enhance>
                        <input type="hidden" name="userWorkspaceId" value={member.id} />
                        <select
                          name="role"
                          class="text-sm rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500"
                          value={member.role}
                          on:change={handleRoleChange}
                        >
                          {#each workspaceRoles as role}
                            <option value={role}>{role}</option>
                          {/each}
                        </select>
                      </form>
                    {/if}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(member.createdAt)}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {#if isCurrentUser(member.user.id)}
                      <span class="text-gray-400">Cannot remove self</span>
                    {:else}
                      <form method="POST" action="?/removeUser" use:enhance>
                        <input type="hidden" name="userId" value={member.user.id} />
                        <button
                          type="submit"
                          class="text-red-600 hover:text-red-900"
                          on:click={(e) => { if (!confirm('Are you sure you want to remove this user from the workspace?')) e.preventDefault(); }}
                        >
                          Remove
                        </button>
                      </form>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>
      
      <!-- Pending Invites -->
        <div class="bg-white border rounded-lg overflow-hidden">
          <div class="px-6 py-4 border-b">
            <h3 class="text-lg font-medium">Pending Invitations for {$workspaceStore.currentWorkspace ? $workspaceStore.currentWorkspace.name : ''}</h3>
          </div>
          
          {#if pendingInvites.length === 0}
            <div class="text-center py-8 text-gray-500">
              <p>No pending invitations</p>
            </div>
          {:else}
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Invited By
                  </th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sent
                  </th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Expires
                  </th>
                  <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                {#each pendingInvites as invite}
                  <tr class="bg-yellow-50">
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="text-sm font-medium text-gray-900">{invite.email}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        {invite.role}
                      </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {#if invite.invitedBy}
                        <div class="flex items-center">
                          {#if invite.invitedBy.avatar}
                            <img 
                              src={invite.invitedBy.avatar} 
                              alt="{invite.invitedBy.displayName || invite.invitedBy.username}" 
                              class="h-6 w-6 rounded-full object-cover border border-slate-200 mr-2"
                            />
                          {:else}
                            <div class="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center mr-2">
                              <span class="text-xs font-medium text-blue-800">
                                {(invite.invitedBy.displayName?.split(' ')[0]?.[0] || invite.invitedBy.email?.split('@')[0]?.[0] || invite.invitedBy.username?.[0] || '?').toUpperCase()}
                              </span>
                            </div>
                          {/if}
                          <span>{invite.invitedBy.displayName || invite.invitedBy.username}</span>
                        </div>
                      {:else}
                        Unknown
                      {/if}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(invite.invitedAt)}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(invite.expiresAt)}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div class="flex justify-end space-x-2">
                        <button
                          class="text-blue-600 hover:text-blue-900"
                          on:click={() => {
                            navigator.clipboard.writeText(`${$page.url.origin}/signup?invite=${invite.token}`);
                            toastStore.success('Invite link copied');
                          }}
                        >
                          Copy Link
                        </button>
                        <form method="POST" action="?/cancelInvite" use:enhance>
                          <input type="hidden" name="inviteId" value={invite.id} />
                          <button
                            type="submit"
                            class="text-red-600 hover:text-red-900 ml-2"
                          >
                            Cancel
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          {/if}
        </div>

  {/if}
</div>
