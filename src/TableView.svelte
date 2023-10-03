<script>
  import { onMount, afterUpdate } from 'svelte';
  import { tableViewConfigStore, currInstanceStore } from './store';
  import * as d3 from 'd3';

  export let tableDataFilepath;

  // Shared states
  let tableViewConfig = undefined;

  let tableData = [];
  let selectedInstanceId = 23;
  let currHighlightedRow = 0;
  let mostRecentColumnSortCriterion = 'true_label';
  let isEmbeddingViewUpdate = false;

  let sortState = {
    sentence: {
      selected: false,
      up: false,
    },
    true_label: {
      selected: false,
      up: false,
    },
    predicted_label: {
      selected: false,
      up: false,
    },
    logit_distance: {
      selected: false,
      up: false,
    },
  };

  let selectedRowColor = 'hsla(0, 0%, 0%, 0.1)';

  let sortBy = { col: 'id', ascending: true };

  $: selectedInstanceId,
    (function () {
      if (
        document.getElementsByTagName('table')[0] &&
        document.getElementsByTagName('table')[0].children[1].children[
          currHighlightedRow
        ]
      ) {
        // We sort by most recent column so that placing
        // the selected instance at the top of the table does
        // not affect the previous sorting. Reactive for
        // when the instanceId store value changes from
        // another source (ie. EmbeddingView).
        if (isEmbeddingViewUpdate) {
          // console.log(mostRecentColumnSortCriterion);
          sort(mostRecentColumnSortCriterion);
        }
      }
      isEmbeddingViewUpdate = true;
    })();

  $: sort = (column) => {
    mostRecentColumnSortCriterion = column;

    if (sortBy.col == column) {
      sortBy.ascending = !sortBy.ascending;
      sortState[column].up = sortBy.ascending;
      sortState = sortState;
    } else {
      if (sortState[sortBy.col] !== undefined) {
        sortState[sortBy.col].selected = false;
      }

      sortBy.col = column;
      sortBy.ascending = true;
      sortState[column].selected = true;
      sortState[column].up = true;
      sortState = sortState;
    }

    let sortModifier = sortBy.ascending ? 1 : -1;

    let sort = (a, b) =>
      a[column] < b[column]
        ? -1 * sortModifier
        : a[column] > b[column]
        ? 1 * sortModifier
        : 0;

    tableData = tableData.sort(sort);

    // If we have an active instance, move it to the begining of the
    // table regardless of the sort.
    tableData.forEach(function (item, i) {
      if (item.id == selectedInstanceId) {
        tableData.splice(i, 1);
        tableData.unshift(item);
      }
    });
    // Update background row color.
    // Remove style from previously selected row.
    document.getElementsByTagName('table')[0].children[1].children[
      currHighlightedRow
    ].style = 'background-color: inherit;';

    // Add style to top row, since sorting
    // by column moves selected row to the top.
    document.getElementsByTagName('table')[0].children[1].children[0].style =
      'background-color: ' + selectedRowColor;
    currHighlightedRow = 0;
    isEmbeddingViewUpdate = false;
  };

  $: getInstance = (row) => {
    currInstanceStore.set(row.cells[0].innerText);
    isEmbeddingViewUpdate = false;
    // console.log('selected row id: ' + row.cells[0].innerText);
    // Remove style from previously selected row.
    document.getElementsByTagName('table')[0].children[1].children[
      currHighlightedRow
    ].style = 'background-color: inherit;';

    // Style newly selected row.
    row.style = 'background-color: ' + selectedRowColor;
    currHighlightedRow = row.rowIndex - 1;
  };

  tableViewConfigStore.subscribe((value) => {
    if (value.compHeight !== undefined && value.compWidth !== undefined) {
      if (
        tableViewConfig === undefined ||
        (tableViewConfig.compHeight !== value.compHeight &&
          tableViewConfig.compWidth !== value.compWidth)
      ) {
        tableViewConfig = value;
      }
    }
  });

  currInstanceStore.subscribe((value) => {
    selectedInstanceId = value;
  });

  onMount(async () => {
    // console.log('loading table');
    tableData = await d3.json(tableDataFilepath);
    // console.log('loaded table');
  });
</script>

<style lang="scss">
  @import 'define';

  table,
  th,
  td {
    font-size: 0.9em;
  }

  table {
    width: 100%;
    table-layout: auto;
    text-align: center;
    border-collapse: collapse;
  }

  td {
    padding: 0 20px 10px 20px;
  }

  th {
    padding: 10px 10px;
    position: sticky;
    z-index: 100;
    top: 0;
    background: hsla(0, 0%, 98%, 1);
    background-clip: padding-box;
    border-bottom: 1px solid hsl(0, 0%, 78%);

    &.sentence {
      width: 61%;
      padding: 10px 20px;
    }

    &.true {
      width: 11%;
      padding: 10px 15px;
    }

    &.predicted {
      width: 15%;
      padding: 10px 15px;
    }

    &.error {
      width: 13%;
      padding: 10px 15px;
    }
  }

  .sentence-div {
    display: flex;
    flex-direction: row;
    align-items: center;
    cursor: pointer;

    &:hover img {
      opacity: 0.5;
    }

    img {
      margin-left: 3px;
      width: 20px;
      opacity: 0.1;

      &.selected {
        opacity: 1;
      }
    }
  }

  .true-div,
  .predicted-div,
  .error-div {
    display: flex;
    flex-direction: row;
    justify-content: flex-end;
    align-items: center;
    cursor: pointer;

    &:hover img {
      opacity: 0.5;
    }

    img {
      margin-left: 3px;
      width: 20px;
      opacity: 0.1;

      &.selected {
        opacity: 1;
      }
    }
  }

  tr:hover {
    background-color: hsla(0, 0%, 0%, 0.05);
    cursor: default;
  }

  tr:first-child {
    background-color: hsla(0, 0%, 0%, 0.1);
  }

  td.number-row {
    text-align: right;
  }

  td.text-row {
    text-align: left;
  }
</style>

<div class="table-view">
  <table>
    <thead>
      <tr>
        <th style="display: none;" on:click={sort('id')}>id</th>
        <th class="sentence" on:click={sort('sentence')}>
          <div class="sentence-div">
            Sentence
            <img
              src={sortState.sentence.up
                ? 'PUBLIC_URL/figures/up.svg'
                : 'PUBLIC_URL/figures/down.svg'}
              class:selected={sortState.sentence.selected}
              alt="sort logo"
            />
          </div>
        </th>

        <th class="true" on:click={sort('true_label')}>
          <div class="true-div">
            True
            <img
              src={sortState['true_label'].up
                ? 'PUBLIC_URL/figures/up.svg'
                : 'PUBLIC_URL/figures/down.svg'}
              class:selected={sortState['true_label'].selected}
              alt="sort logo"
            />
          </div>
        </th>

        <th class="predicted" on:click={sort('predicted_label')}>
          <div class="predicted-div">
            Predicted
            <img
              src={sortState['predicted_label'].up
                ? 'PUBLIC_URL/figures/up.svg'
                : 'PUBLIC_URL/figures/down.svg'}
              class:selected={sortState['predicted_label'].selected}
              alt="sort logo"
            />
          </div>
        </th>

        <th class="error" on:click={sort('logit_distance')}>
          <div class="error-div">
            Error
            <img
              src={sortState['logit_distance'].up
                ? 'PUBLIC_URL/figures/up.svg'
                : 'PUBLIC_URL/figures/down.svg'}
              class:selected={sortState['logit_distance'].selected}
              alt="sort logo"
            />
          </div>
        </th>
      </tr>
    </thead>
    <tbody>
      {#each tableData as row}
        <tr on:click={getInstance(this)}>
          <td style="display: none;">{row.id}</td>
          <td class="text-row">{row.sentence}</td>
          <td class="number-row">{row.true_label}</td>
          <td class="number-row">{row.predicted_label}</td>
          <td class="number-row">{Number(row.logit_distance.toFixed(2))}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
