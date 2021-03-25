<script>
  import { onMount, createEventDispatcher } from 'svelte';
  import { tableModalStore, instanceIDStore, currInstanceStore } from './store';
  import EmbeddingView from './EmbeddingView.svelte';
  import TableView from './TableView.svelte';

  export let tableDataFilepath;
  export let embeddingDataFilepath;

  let modalComponent;

  const dispatch = createEventDispatcher();
  let modalInfo = {
    show: false
  };
  let tempID = null;
  currInstanceStore.subscribe(value => {tempID = value;});

  tableModalStore.set(modalInfo);
  tableModalStore.subscribe(value => {modalInfo = value});

  const crossClicked = () => {
    modalInfo.show = false;
    tableModalStore.set(modalInfo);
    // Dispatch the parent component
    dispatch('xClicked', {preImage: modalInfo.preImage});
  };

  const okClicked = () => {
    modalInfo.show = false;
    instanceIDStore.set(tempID);
    // Dispatch the parent component
    dispatch('xClicked', {preImage: modalInfo.preImage});
  };

  onMount(() => {

  });
</script>

<style>

  .modal-container {
    margin: 0 auto;
    display: flex;
    flex-direction: row-reverse;
    align-items: center;
  }

  .modal-card {
    width: '';
    max-width: 700px;
    max-height: 600px;
    position: relative;
  }

  .modal-card-title {
    font-size: 20px;
  }

  .modal-card-head {
    padding: 15px 20px;
  }

  .modal-card-body {
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
    align-items: flex-start;
    padding: 0;
  }

  .modal-card-foot {
    padding: 12px 20px;
    justify-content: space-between;
  }

  .is-smaller {
    font-size: 15px;
    padding: 0.5em 0.8em;
    max-height: 2.2em;
  }

  .embedding-div {
    width: 350px;
    height: 351px;
    /* margin-top: 50px; */
    margin-right: 20px;
    z-index: 1;
    background: white;
    border-top-right-radius: 6px;
    border-bottom-right-radius: 6px;
    border-radius: 6px;
  }

  .center {
    text-align: center;
  }

</style>


<div class="modal-component"
  bind:this={modalComponent}>

  <div class="modal"
    id="input-modal"
    class:is-active={modalInfo.show}>

    <div class="modal-background" on:click={crossClicked}></div>

    <div class='modal-container'>

      <div class="modal-card">
        <header class="modal-card-head">
          <p class="modal-card-title">Select Input Sentence</p>
          <button class="delete" aria-label="close" on:click={crossClicked}></button>
        </header>

        <section class="modal-card-body">
          
          <TableView tableDataFilepath={tableDataFilepath} />

        </section>

        <footer class="modal-card-foot">

          <div class="button-container">
            <button class="button is-smaller"
              on:click={crossClicked}>
              Cancel
            </button>

            <button class="button is-success is-smaller"
              on:click={okClicked}>
              Add
            </button>
          </div>

        </footer>

      </div>

      <div class='embedding-div'>
        <header class="modal-card-head">
          <p class="modal-card-title center">Instance Embedding</p>
        </header>

        <EmbeddingView embeddingDataFilepath={embeddingDataFilepath} />
      </div>

    </div>

  </div>

</div>