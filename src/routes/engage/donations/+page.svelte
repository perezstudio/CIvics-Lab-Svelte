<!-- src/routes/engage/donations/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';
  import { workspaceStore } from '$lib/stores/workspaceStore';
  import { toastStore } from '$lib/stores/toastStore';
  import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
  import type { PageData } from './$types';
  
  // Import components
  import DonationsViewNavbar from '$lib/components/donations/DonationsViewNavbar.svelte';
  import DonationsFilterSortBar from '$lib/components/donations/DonationsFilterSortBar.svelte';
  import DonationsDataGrid from '$lib/components/donations/DonationsDataGrid.svelte';
  import DonationsViewModals from '$lib/components/donations/DonationsViewModals.svelte';
  
  export let data: PageData;
  
  // State for modals
  const isDonationModalOpen = writable(false);
  const isCreateViewModalOpen = writable(false);
  const isEditViewModalOpen = writable(false);
  const isDeleteViewModalOpen = writable(false);
  
  // State for view settings popover
  const isViewSettingsOpen = writable(false);
  const isViewSelectOpen = writable(false);
  const isFilterPopoverOpen = writable(false);
  const isSortPopoverOpen = writable(false);
  
  // View management
  const views = writable<any[]>([]);
  // Use browser localStorage to persist the current view
  const createPersistentViewStore = () => {
    const storedViewId = typeof window !== 'undefined' 
      ? localStorage.getItem('currentDonationViewId') 
      : null;
    
    const { subscribe, set, update } = writable<any | null>(null);
    
    return {
      subscribe,
      set: (view) => {
        // Store the view ID in localStorage when set
        if (view && view.id && typeof window !== 'undefined') {
          localStorage.setItem('currentDonationViewId', view.id);
        }
        set(view);
      },
      update
    };
  };
  
  const currentView = createPersistentViewStore();
  const newViewName = writable('');
  const viewsLoading = writable(false);
  const viewsError = writable<string | null>(null);
  
  // Fields that can be displayed/filtered/sorted
  const availableFields = writable([
    { id: 'amount', label: 'Amount' },
    { id: 'status', label: 'Status' },
    { id: 'payment_type', label: 'Payment Type' },
    { id: 'notes', label: 'Notes' }
  ]);
  
  // Filters state
  const filters = writable<any[]>([]);
  
  // Sort state
  const sorting = writable<any[]>([]);
  
  // Search state
  const searchQuery = writable('');
  
  // Donations data
  const donations = writable<any[]>([]);
  const filteredDonations = writable<any[]>([]);
  const isLoadingDonations = writable(false);
  const donationsError = writable<string | null>(null);
  
  // Donation stats
  const donationStats = writable({
    totalAmount: 0,
    averageAmount: 0,
    donorCount: 0
  });
  
  // View event handlers
  function handleSelectView(event) {
    const view = event.detail;
    currentView.set(view);
    filters.set(view.filters || []);
    sorting.set(view.sorting || []);
    // Re-apply filters and sorting when view changes
    applyFiltersAndSorting();
  }
  
  function handleToggleField(event) {
    toggleField(event.detail);
  }
  
  function handleOpenCreateViewModal() {
    newViewName.set('');
    isCreateViewModalOpen.set(true);
  }
  
  function handleOpenEditViewModal() {
    if ($currentView) {
      newViewName.set($currentView.view_name);
      isEditViewModalOpen.set(true);
    }
  }
  
  function handleOpenDeleteViewModal() {
    isDeleteViewModalOpen.set(true);
  }
  
  function handleOpenDonationModal() {
    isDonationModalOpen.set(true);
  }
  
  function handleCloseDonationModal() {
    isDonationModalOpen.set(false);
  }
  
  function handleDonationCreated() {
    fetchDonations();
  }
  
  function handleDonationUpdated() {
    fetchDonations();
  }
  
  function handleAddFilter() {
    addFilter();
  }
  
  function handleRemoveFilter(event) {
    removeFilter(event.detail);
  }
  
  function handleMoveFilter(event) {
    const { index, direction } = event.detail;
    moveFilter(index, direction);
  }
  
  function handleAddSort() {
    addSort();
  }
  
  function handleRemoveSort(event) {
    removeSort(event.detail);
  }
  
  function handleMoveSort(event) {
    const { index, direction } = event.detail;
    moveSort(index, direction);
  }
  
  function handleFilterChanged() {
    updateView();
    applyFiltersAndSorting();
  }
  
  function handleSortChanged() {
    updateView();
    applyFiltersAndSorting();
  }
  
  function handleSearchChanged(event) {
    if (event && event.detail !== undefined) {
      searchQuery.set(event.detail);
    }
    applyFiltersAndSorting();
  }
  
  function handleAddDonation() {
    isDonationModalOpen.set(true);
  }
  
  // Fetch views for the current workspace
  async function fetchViews(selectViewId = null) {
    if (!$workspaceStore.currentWorkspace) return;
    
    viewsLoading.set(true);
    viewsError.set(null);
    
    try {
      const { data: fetchedViews, error } = await data.supabase
        .from('donation_views')
        .select('*')
        .eq('workspace_id', $workspaceStore.currentWorkspace.id)
        .order('view_name');
      
      if (error) throw error;
      
      if (fetchedViews && fetchedViews.length > 0) {
        views.set(fetchedViews);
        
        // If a specific view ID is provided, select that view
        if (selectViewId) {
          const viewToSelect = fetchedViews.find(view => view.id === selectViewId);
          if (viewToSelect) {
            currentView.set(viewToSelect);
            filters.set(viewToSelect.filters || []);
            sorting.set(viewToSelect.sorting || []);
            return;
          }
        }
        
        // Try to restore the previously selected view from localStorage
        const storedViewId = typeof window !== 'undefined' 
          ? localStorage.getItem('currentDonationViewId') 
          : null;
        
        if (storedViewId) {
          // Find the view with the stored ID
          const savedView = fetchedViews.find(view => view.id === storedViewId);
          if (savedView) {
            currentView.set(savedView);
            filters.set(savedView.filters || []);
            sorting.set(savedView.sorting || []);
          } else {
            // If stored view is not found, use the first one
            currentView.set(fetchedViews[0]);
            filters.set(fetchedViews[0].filters || []);
            sorting.set(fetchedViews[0].sorting || []);
          }
        } else {
          // If no stored view, use the first one
          currentView.set(fetchedViews[0]);
          filters.set(fetchedViews[0].filters || []);
          sorting.set(fetchedViews[0].sorting || []);
        }
      } else {
        // Create a default view if none exists
        await createDefaultView();
      }
    } catch (error) {
      console.error('Error fetching views:', error);
      viewsError.set('Failed to load views');
    } finally {
      viewsLoading.set(false);
    }
  }
  
  // Create a default view if none exists
  async function createDefaultView() {
    if (!$workspaceStore.currentWorkspace) return;
    
    try {
      const defaultView = {
        view_name: 'Default View',
        workspace_id: $workspaceStore.currentWorkspace.id,
        amount: true,
        status: true,
        payment_type: true,
        notes: false,
        filters: [],
        sorting: []
      };
      
      const { data: newView, error } = await data.supabase
        .from('donation_views')
        .insert(defaultView)
        .select()
        .single();
      
      if (error) throw error;
      
      views.set([newView]);
      currentView.set(newView);
      filters.set([]);
      sorting.set([]);
      
    } catch (error) {
      console.error('Error creating default view:', error);
      viewsError.set('Failed to create default view');
    }
  }
  
  // Create a new view
  async function createView(event) {
    const viewName = event.detail;
    if (!$workspaceStore.currentWorkspace || !viewName.trim()) return;
    
    try {
      // Create the view with default fields visible
      const newView = {
        view_name: viewName.trim(),
        workspace_id: $workspaceStore.currentWorkspace.id,
        amount: true,
        status: true,
        payment_type: true,
        notes: true,
        filters: [],
        sorting: []
      };
      
      const { data: createdView, error } = await data.supabase
        .from('donation_views')
        .insert(newView)
        .select()
        .single();
      
      if (error) throw error;
      
      // Close modal first to avoid any state issues
      isCreateViewModalOpen.set(false);
      newViewName.set('');
      
      // Re-fetch all views to ensure consistency
      await fetchViews();
      
      // Find the newly created view in the refreshed list
      const refreshedView = $views.find(v => v.id === createdView.id);
      if (refreshedView) {
        // Set as current view
        currentView.set(refreshedView);
        filters.set(refreshedView.filters || []);
        sorting.set(refreshedView.sorting || []);
      }
      
      toastStore.success('View created successfully');
      
    } catch (error) {
      console.error('Error creating view:', error);
      toastStore.error('Failed to create view');
    }
  }
  
  // Update a view
  async function updateView(event) {
    if (!$currentView) {
      console.error('No current view to update');
      return;
    }
    
    try {
      let updatedViewName = '';
      
      // Determine the new view name
      if (event && event.detail) {
        // Get name from event if available
        updatedViewName = event.detail.trim();
      } else if ($isEditViewModalOpen && $newViewName.trim()) {
        // Get name from store if modal is open
        updatedViewName = $newViewName.trim();
      } else {
        // Fallback to current name
        updatedViewName = $currentView.view_name;
      }
      
      if (!updatedViewName) {
        console.error('No valid view name for update');
        return;
      }
      
      // Create updated view object
      const updatedView = {
        ...$currentView,
        view_name: updatedViewName,
        filters: $filters,
        sorting: $sorting
      };
      
      // Update in Supabase
      const { data: updatedData, error } = await data.supabase
        .from('donation_views')
        .update(updatedView)
        .eq('id', $currentView.id)
        .select();
      
      if (error) {
        throw error;
      }
      
      // Update the views list
      views.update(viewsList => 
        viewsList.map(view => view.id === $currentView.id 
          ? updatedView 
          : view
        )
      );
      
      // Update current view
      currentView.set(updatedView);
      
      // Close the edit modal if it's open
      if ($isEditViewModalOpen) {
        isEditViewModalOpen.set(false);
        newViewName.set('');
      }
      
      toastStore.success('View updated successfully');
      
      // Refresh views from database to ensure consistency
      await fetchViews($currentView.id);
      
    } catch (error) {
      console.error('Error updating view:', error);
      toastStore.error('Failed to update view: ' + (error.message || 'Unknown error'));
    }
  }
  
  // Delete a view
  async function deleteView() {
    if (!$currentView) return;
    
    try {
      const { error } = await data.supabase
        .from('donation_views')
        .delete()
        .eq('id', $currentView.id);
      
      if (error) throw error;
      
      // Remove the view from the list
      views.update(v => v.filter(view => view.id !== $currentView.id));
      
      // Set the first remaining view as current, or create a default if none left
      if ($views.length > 0) {
        currentView.set($views[0]);
        filters.set($views[0].filters || []);
        sorting.set($views[0].sorting || []);
      } else {
        await createDefaultView();
      }
      
      isDeleteViewModalOpen.set(false);
      toastStore.success('View deleted successfully');
      
    } catch (error) {
      console.error('Error deleting view:', error);
      toastStore.error('Failed to delete view');
    }
  }
  
  // Toggle a field's visibility in the current view
  async function toggleField(fieldId) {
    if (!$currentView) return;
    
    try {
      const updatedView = { ...$currentView, [fieldId]: !$currentView[fieldId] };
      
      const { error } = await data.supabase
        .from('donation_views')
        .update({ [fieldId]: !$currentView[fieldId] })
        .eq('id', $currentView.id);
      
      if (error) throw error;
      
      // Update the current view
      currentView.set(updatedView);
      
      // Update the view in the list
      views.update(v => 
        v.map(view => view.id === $currentView.id 
          ? updatedView 
          : view
        )
      );
      
    } catch (error) {
      console.error('Error toggling field:', error);
      toastStore.error('Failed to update view');
    }
  }
  
  // Add a new filter
  function addFilter() {
    filters.update(f => [
      ...f, 
      { field: Object.keys($currentView).find(key => $currentView[key] === true) || 'amount', operator: '=', value: '' }
    ]);
  }
  
  // Remove a filter
  function removeFilter(index) {
    filters.update(f => f.filter((_, i) => i !== index));
    updateView();
    applyFiltersAndSorting();
  }
  
  // Add a new sort
  function addSort() {
    sorting.update(s => [
      ...s, 
      { field: Object.keys($currentView).find(key => $currentView[key] === true) || 'amount', direction: 'asc' }
    ]);
  }
  
  // Remove a sort
  function removeSort(index) {
    sorting.update(s => s.filter((_, i) => i !== index));
    updateView();
    applyFiltersAndSorting();
  }
  
  // Move filter up or down
  function moveFilter(index, direction) {
    filters.update(f => {
      const newFilters = [...f];
      if (direction === 'up' && index > 0) {
        [newFilters[index], newFilters[index - 1]] = [newFilters[index - 1], newFilters[index]];
      } else if (direction === 'down' && index < newFilters.length - 1) {
        [newFilters[index], newFilters[index + 1]] = [newFilters[index + 1], newFilters[index]];
      }
      return newFilters;
    });
    updateView();
    applyFiltersAndSorting();
  }
  
  // Move sort up or down
  function moveSort(index, direction) {
    sorting.update(s => {
      const newSorting = [...s];
      if (direction === 'up' && index > 0) {
        [newSorting[index], newSorting[index - 1]] = [newSorting[index - 1], newSorting[index]];
      } else if (direction === 'down' && index < newSorting.length - 1) {
        [newSorting[index], newSorting[index + 1]] = [newSorting[index + 1], newSorting[index]];
      }
      return newSorting;
    });
    updateView();
    applyFiltersAndSorting();
  }
  
  // Function to fetch donations
  async function fetchDonations() {
    if (!$workspaceStore.currentWorkspace) return;
    
    isLoadingDonations.set(true);
    donationsError.set(null);
    
    try {
      const { data: fetchedDonations, error } = await data.supabase
        .from('donations')
        .select(`
          id,
          amount,
          status,
          payment_type,
          notes,
          created_at,
          contacts:contact_id (id, first_name, last_name),
          businesses:business_id (id, business_name)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      donations.set(fetchedDonations || []);
      applyFiltersAndSorting();
      
      // Calculate donation stats
      if (fetchedDonations && fetchedDonations.length > 0) {
        const totalAmount = fetchedDonations.reduce((sum, donation) => sum + donation.amount, 0);
        const averageAmount = totalAmount / fetchedDonations.length;
        
        // Count unique donors
        const contactDonorIds = new Set();
        const businessDonorIds = new Set();
        
        fetchedDonations.forEach(donation => {
          if (donation.contacts && donation.contacts.id) {
            contactDonorIds.add(donation.contacts.id);
          } else if (donation.businesses && donation.businesses.id) {
            businessDonorIds.add(donation.businesses.id);
          }
        });
        
        const uniqueDonorCount = contactDonorIds.size + businessDonorIds.size;
        
        donationStats.set({
          totalAmount,
          averageAmount,
          donorCount: uniqueDonorCount
        });
      } else {
        donationStats.set({
          totalAmount: 0,
          averageAmount: 0,
          donorCount: 0
        });
      }
    } catch (error) {
      console.error('Error fetching donations:', error);
      donationsError.set('Failed to load donations');
    } finally {
      isLoadingDonations.set(false);
    }
  }
  
  // Apply filters and sorting to donations
  function applyFiltersAndSorting() {
    let result = [...$donations];
    
    // Apply filters
    if ($filters && $filters.length > 0) {
      $filters.forEach(filter => {
        if (filter.field && filter.operator && filter.value) {
          result = result.filter(donation => {
            const donationValue = donation[filter.field];
            if (donationValue === null || donationValue === undefined) return false;
            
            switch(filter.operator) {
              case '=':
                return String(donationValue).toLowerCase() === String(filter.value).toLowerCase();
              case '!=':
                return String(donationValue).toLowerCase() !== String(filter.value).toLowerCase();
              case 'contains':
                return String(donationValue).toLowerCase().includes(String(filter.value).toLowerCase());
              case 'startsWith':
                return String(donationValue).toLowerCase().startsWith(String(filter.value).toLowerCase());
              case 'endsWith':
                return String(donationValue).toLowerCase().endsWith(String(filter.value).toLowerCase());
              case '>':
                return parseFloat(donationValue) > parseFloat(filter.value);
              case '<':
                return parseFloat(donationValue) < parseFloat(filter.value);
              case '>=':
                return parseFloat(donationValue) >= parseFloat(filter.value);
              case '<=':
                return parseFloat(donationValue) <= parseFloat(filter.value);
              default:
                return true;
            }
          });
        }
      });
    }
    
    // Apply search
    if ($searchQuery.trim()) {
      const query = $searchQuery.toLowerCase().trim();
      result = result.filter(donation => {
        // Helper function to safely check if a field includes the search query
        const fieldIncludes = (field) => {
          if (!field) return false;
          return String(field).toLowerCase().includes(query);
        };
        
        // Search donor name
        const donorName = getDonorName(donation);
        if (donorName.toLowerCase().includes(query)) return true;
        
        // Search in other fields
        return (
          fieldIncludes(donation.amount) ||
          fieldIncludes(donation.status) ||
          fieldIncludes(donation.payment_type) ||
          fieldIncludes(donation.notes)
        );
      });
    }
    
    // Apply sorting
    if ($sorting && $sorting.length > 0) {
      result.sort((a, b) => {
        for (const sort of $sorting) {
          if (!sort.field) continue;
          
          const valueA = a[sort.field] || '';
          const valueB = b[sort.field] || '';
          
          // Special handling for amount field
          if (sort.field === 'amount') {
            const numA = parseFloat(valueA);
            const numB = parseFloat(valueB);
            if (numA < numB) return sort.direction === 'asc' ? -1 : 1;
            if (numA > numB) return sort.direction === 'asc' ? 1 : -1;
            continue;
          }
          
          // Normal string comparison for other fields
          if (String(valueA).toLowerCase() < String(valueB).toLowerCase()) {
            return sort.direction === 'asc' ? -1 : 1;
          }
          if (String(valueA).toLowerCase() > String(valueB).toLowerCase()) {
            return sort.direction === 'asc' ? 1 : -1;
          }
        }
        return 0;
      });
    }
    
    filteredDonations.set(result);
  }
  
  // Get donor name from donation
  function getDonorName(donation) {
    if (donation.contacts && donation.contacts.first_name) {
      return `${donation.contacts.first_name} ${donation.contacts.last_name || ''}`.trim();
    } else if (donation.businesses && donation.businesses.business_name) {
      return donation.businesses.business_name;
    }
    return '—';
  }
  
  // Watch for changes that should trigger filtering/sorting
  $: if ($searchQuery !== undefined) {
    applyFiltersAndSorting();
  }
  
  $: if ($filters !== undefined) {
    applyFiltersAndSorting();
  }
  
  $: if ($sorting !== undefined) {
    applyFiltersAndSorting();
  }
  
  // Initialize data on component mount
  onMount(() => {
    if ($workspaceStore.currentWorkspace) {
      fetchViews();
      fetchDonations();
    }
  });
  
  // Fetch data when workspace changes
  $: if ($workspaceStore.currentWorkspace) {
    fetchViews();
    fetchDonations();
  }
</script>

<svelte:head>
  <title>Donations | Engagement Portal</title>
</svelte:head>

<div class="h-full flex flex-col">
  {#if $workspaceStore.isLoading}
    <div class="flex-1 flex justify-center items-center">
      <LoadingSpinner size="lg" />
    </div>
  {:else if !$workspaceStore.currentWorkspace}
    <div class="bg-white p-8 rounded-lg shadow-md m-6">
      <h2 class="text-xl font-semibold mb-4 text-gray-700">No Workspace Selected</h2>
      <p class="text-gray-600">
        Please select a workspace from the dropdown in the sidebar to continue.
      </p>
    </div>
  {:else}
    <!-- Navbar with view selector and settings -->
    <DonationsViewNavbar 
      views={$views}
      currentView={$currentView}
      viewsLoading={$viewsLoading}
      viewsError={$viewsError}
      isViewSelectOpen={$isViewSelectOpen}
      isViewSettingsOpen={$isViewSettingsOpen}
      availableFields={$availableFields}
      on:selectView={handleSelectView}
      on:toggleField={handleToggleField}
      on:openCreateViewModal={handleOpenCreateViewModal}
      on:openEditViewModal={handleOpenEditViewModal}
      on:openDeleteViewModal={handleOpenDeleteViewModal}
      on:openDonationModal={handleOpenDonationModal}
    />
    
    <!-- Filter, sort, search and stats bar -->
    <DonationsFilterSortBar 
      isFilterPopoverOpen={$isFilterPopoverOpen}
      isSortPopoverOpen={$isSortPopoverOpen}
      filters={$filters}
      sorting={$sorting}
      searchQuery={$searchQuery}
      availableFields={$availableFields}
      currentView={$currentView}
      donationStats={$donationStats}
      on:addFilter={handleAddFilter}
      on:removeFilter={handleRemoveFilter}
      on:moveFilter={handleMoveFilter}
      on:addSort={handleAddSort}
      on:removeSort={handleRemoveSort}
      on:moveSort={handleMoveSort}
      on:filterChanged={handleFilterChanged}
      on:sortChanged={handleSortChanged}
      on:searchChanged={handleSearchChanged}
    />
    
    <!-- Donations data grid with details sheet integrated -->
    <DonationsDataGrid 
      donations={$filteredDonations}
      isLoading={$isLoadingDonations}
      error={$donationsError}
      visibleColumns={$currentView ? Object.entries($currentView)
        .filter(([key, value]) => value === true && !key.startsWith('_'))
        .map(([key]) => key) : []}
      availableFields={$availableFields}
      supabase={data.supabase}
      on:addDonation={handleAddDonation}
      on:donationUpdated={handleDonationUpdated}
    />
    
    <!-- Modals for donation and view management -->
    <DonationsViewModals 
      isDonationModalOpen={$isDonationModalOpen}
      isCreateViewModalOpen={$isCreateViewModalOpen}
      isEditViewModalOpen={$isEditViewModalOpen}
      isDeleteViewModalOpen={$isDeleteViewModalOpen}
      newViewName={$newViewName}
      currentView={$currentView}
      supabase={data.supabase}
      on:closeContactModal={handleCloseDonationModal}
      on:donationCreated={handleDonationCreated}
      on:createView={createView}
      on:updateView={updateView}
      on:deleteView={deleteView}
      on:closeCreateViewModal={() => isCreateViewModalOpen.set(false)}
      on:closeEditViewModal={() => isEditViewModalOpen.set(false)}
      on:closeDeleteViewModal={() => isDeleteViewModalOpen.set(false)}
    />
  {/if}
</div>