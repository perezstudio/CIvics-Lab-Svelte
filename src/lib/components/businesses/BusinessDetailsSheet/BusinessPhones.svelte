<!-- src/lib/components/businesses/BusinessDetailsSheet/BusinessPhones.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { Plus, X, Phone } from '@lucide/svelte';
  
  // Props
  export let phoneNumbers;
  export let isSaving = false;
  
  const dispatch = createEventDispatcher();
  
  function handleChange() {
    dispatch('change');
  }
  
  function addPhone() {
    phoneNumbers.update(items => [...items, { 
      phone_number: '', 
      status: 'active',
      isNew: true 
    }]);
    handleChange();
  }
  
  function removePhone(index) {
    phoneNumbers.update(items => {
      const updatedItems = [...items];
      const item = updatedItems[index];
      
      if (item.id) {
        // For existing items, mark as deleted
        item.isDeleted = true;
      } else {
        // For new items, just remove from array
        updatedItems.splice(index, 1);
      }
      
      return updatedItems;
    });
    handleChange();
  }
  
  function updatePhone(index, field, value) {
    phoneNumbers.update(items => {
      const updatedItems = [...items];
      const item = updatedItems[index];
      
      if (item.id && !item.isNew) {
        // Mark as modified for existing items
        item.isModified = true;
      }
      
      item[field] = value;
      return updatedItems;
    });
    handleChange();
  }
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between border-b border-slate-200 pb-4">
    <div>
      <h3 class="text-lg font-semibold leading-6 text-slate-900">Phone Numbers</h3>
      <p class="mt-1 text-sm text-slate-600">Manage business contact numbers and their status.</p>
    </div>
    <button
      type="button"
      class="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-slate-300 bg-white hover:bg-slate-50 hover:text-slate-900 h-9 px-3"
      on:click={addPhone}
      disabled={isSaving}
    >
      <Plus class="h-4 w-4" />
      Add Phone
    </button>
  </div>
  
  <div class="space-y-4">
    {#each $phoneNumbers.filter(item => !item.isDeleted) as phone, i}
      <div class="relative rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <button 
          type="button" 
          class="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors" 
          on:click={() => removePhone(i)}
          disabled={isSaving}
        >
          <X class="h-4 w-4" />
          <span class="sr-only">Remove phone</span>
        </button>
        
        <div class="grid gap-4 pr-8 md:grid-cols-3">
          <div class="md:col-span-2 space-y-2">
            <label for="phone_{i}" class="block text-sm font-medium text-slate-700">
              Phone Number
            </label>
            <input 
              type="tel" 
              id="phone_{i}" 
              value={phone.phone_number}
              on:input={(e) => updatePhone(i, 'phone_number', e.target.value)}
              class="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isSaving}
              placeholder="(555) 555-5555"
            />
          </div>
          
          <div class="space-y-2">
            <label for="phone_status_{i}" class="block text-sm font-medium text-slate-700">Status</label>
            <select 
              id="phone_status_{i}" 
              value={phone.status}
              on:change={(e) => updatePhone(i, 'status', e.target.value)}
              class="flex h-9 w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isSaving}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="wrong number">Wrong Number</option>
              <option value="disconnected">Disconnected</option>
            </select>
          </div>
        </div>
      </div>
    {/each}
    
    {#if $phoneNumbers.filter(item => !item.isDeleted).length === 0}
      <div class="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
        <Phone class="h-8 w-8 text-slate-400 mb-3" />
        <h3 class="text-sm font-medium text-slate-900 mb-1">No phone numbers</h3>
        <p class="text-sm text-slate-600 mb-4">Get started by adding your first phone number.</p>
        <button
          type="button"
          class="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-slate-900 text-white hover:bg-slate-800 h-9 px-3"
          on:click={addPhone}
          disabled={isSaving}
        >
          <Plus class="h-4 w-4" />
          Add Phone Number
        </button>
      </div>
    {/if}
  </div>
</div>