<script>
  import { onMount, afterUpdate } from 'svelte';
  import { tableViewConfigStore } from './store';
  import * as d3 from 'd3';
  
  // Shared states
  let tableViewConfig = undefined;

  let tableData = [];

  let sortBy = {col: "id", ascending: true};
  
  $: sort = (column) => {
    
    if (sortBy.col == column) {
      sortBy.ascending = !sortBy.ascending
    } else {
      sortBy.col = column
      sortBy.ascending = true
    }
    
    let sortModifier = (sortBy.ascending) ? 1 : -1;
    
    let sort = (a, b) => 
      (a[column] < b[column]) 
      ? -1 * sortModifier 
      : (a[column] > b[column]) 
      ? 1 * sortModifier 
      : 0;
    
    tableData = tableData.sort(sort);
  }

  tableViewConfigStore.subscribe(value => {
    if (value.compHeight !== undefined && value.compWidth !== undefined){
      if (tableViewConfig === undefined
        || (tableViewConfig.compHeight !== value.compHeight
        && tableViewConfig.compWidth !== value.compWidth)){
        tableViewConfig = value;
      }
    }
  });

 onMount(async () => {
  console.log('loading table');
  tableData = await d3.json('/data/table_list_top_300.json');
  console.log('loaded table');
  })
  
</script>

<style type="text/scss">
  table, th, td {
    border: 1px solid black;
    border-collapse: collapse;
  }

  table {
    background: #eee;
    width: 50%;
    text-align: center;
  }
</style>

<div class='table-view'>
  <table>
  <thead>
    <tr>
      <th on:click={sort("id")}>id</th>
      <th on:click={sort("sentence")}>sentence</th>
      <th on:click={sort("true_label")}>true label</th>
      <th on:click={sort("predicted_label")}>predicted label</th>
      <th on:click={sort("logit_distance")}>logit distance</th>
    </tr>
  </thead>
  <tbody>
    {#each tableData as row}
      <tr>
        <td>{row.id}</td>
        <td>{row.sentence}</td>
        <td>{row.true_label}</td>
        <td>{row.predicted_label}</td>
        <td>{Number((row.logit_distance).toFixed(2))}</td>
      </tr>
    {/each}
  </tbody>
</table>
</div>