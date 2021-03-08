<script>
  import { onMount, afterUpdate } from 'svelte';
  import { tableViewConfigStore, currInstanceStore } from './store';
  import * as d3 from 'd3';
  
  // Shared states
  let tableViewConfig = undefined;

  let tableData = [];
  let selectedInstanceId = 23;
  let currHighlightedRow = 0;
  let mostRecentColumnSortCriterion = 'id';
  let isEmbeddingViewUpdate = false;

  let twitterLabelMap = {
    'positive': 0,
    'neutral': 1,
    'negative': 2
  };

  let selectedRowColor = 'hsla(0, 0%, 0%, 0.1)';

  let sortBy = {col: 'id', ascending: true};

  $: selectedInstanceId, function(){
    if (document.getElementsByTagName('table')[0]
      && document.getElementsByTagName('table')[0]
        .children[1].children[currHighlightedRow]) {
      // We sort by most recent column so that placing
      // the selected instance at the top of the table does
      // not affect the previous sorting. Reactive for
      // when the instanceId store value changes from
      // another source (ie. EmbeddingView).
      if (isEmbeddingViewUpdate) {
        sort(mostRecentColumnSortCriterion);
      }
    }
    isEmbeddingViewUpdate = true;
  }();
  
  $: sort = (column) => {
    mostRecentColumnSortCriterion = column;
    
    if (sortBy.col == column) {
      sortBy.ascending = !sortBy.ascending;
    } else {
      sortBy.col = column;
      sortBy.ascending = true;
    }
    
    let sortModifier = (sortBy.ascending) ? 1 : -1;
    
    let sort = (a, b) => 
      (a[column] < b[column]) 
        ? -1 * sortModifier 
        : (a[column] > b[column]) 
          ? 1 * sortModifier 
          : 0;
    
    tableData = tableData.sort(sort);

    // If we have an active instance, move it to the begining of the
    // table regardless of the sort.
    tableData.forEach(function(item, i){
      if(item.id == selectedInstanceId){
        tableData.splice(i, 1);
        tableData.unshift(item);
      }
    });
    // Update background row color.
    // Remove style from previously selected row.
    document.getElementsByTagName('table')[0].children[1]
      .children[currHighlightedRow].style = 'background-color: inherit;';

    // Add style to top row, since sorting
    // by column moves selected row to the top.
    document.getElementsByTagName('table')[0].children[1]
      .children[0].style = 'background-color: ' + selectedRowColor;
    currHighlightedRow = 0;
    isEmbeddingViewUpdate = false;
  };

  $: getInstance = (row) => {
    currInstanceStore.set(row.cells[0].innerText);
    isEmbeddingViewUpdate = false;
    console.log('selected row id: ' + row.cells[0].innerText);
    // Remove style from previously selected row.
    document.getElementsByTagName('table')[0].children[1]
      .children[currHighlightedRow].style = 'background-color: inherit;';

    // Style newly selected row.
    row.style = 'background-color: ' + selectedRowColor;
    currHighlightedRow = row.rowIndex - 1;
  };

  tableViewConfigStore.subscribe(value => {
    if (value.compHeight !== undefined && value.compWidth !== undefined){
      if (tableViewConfig === undefined
        || (tableViewConfig.compHeight !== value.compHeight
        && tableViewConfig.compWidth !== value.compWidth)){
        tableViewConfig = value;
      }
    }
  });

  currInstanceStore.subscribe(value => {
    selectedInstanceId = value;
  });

  onMount(async () => {
    console.log('loading table');
    tableData = await d3.json('/data/table-list-sst2.json');
    console.log('loaded table');
  });
  
</script>

<style type='text/scss'>
  @import 'define';

  table, th, td { 
    font-size: 0.9em;
  }

  table {
    width: 100%;
    table-layout: auto;
    text-align: center;
    border-collapse: collapse;
  }

  td {
    padding-bottom: 10px;
  }

  th {
    padding: 10px 0;
    position: sticky;
    z-index: 100;
    top: 0;
    background: hsla(0, 0%, 98%, 1);
    background-clip: padding-box;
    border-bottom: 1px solid hsl(0, 0%, 78%);

    &.sentence {
      width: 61%;
    }

    &.true, &.predicted, &.error {
      width: 13%;
    }
  }


  tr:hover { 
    background-color: hsla(0, 0%, 0%, 0.05);
    cursor: default;
  }

  tr:first-child {
    background-color: hsla(0, 0%, 0%, 0.1);
  }

  td.numberRow {
    text-align: right;
  }
</style>

<div class='table-view'>
  <table>
    <thead>
      <tr>
        <th style='display: none;' on:click={sort('id')}>id</th>
        <th class='sentence' on:click={sort('sentence')}>Sentence</th>
        <th class='true' on:click={sort('true_label')}>True</th>
        <th class='predicted' on:click={sort('predicted_label')}>Predicted</th>
        <th class='error' on:click={sort('logit_distance')}>Error</th>
      </tr>
    </thead>
    <tbody>
      {#each tableData as row}
        <tr on:click={getInstance(this)}>
          <td style='display: none;'>{row.id}</td>
          <td>{row.sentence}</td>
          <td class="numberRow">{row.true_label}</td>
          <td class="numberRow">{row.predicted_label}</td>
          <td class="numberRow">{Number((row.logit_distance).toFixed(2))}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>