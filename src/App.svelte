<script>
  import Main from './Main.svelte';
  import GraphView from './GraphView.svelte';
  import Saliency from './Saliency.svelte';
  import CircleView from './CircleView.svelte';
  import GridView from './GridView.svelte';
  import RadialView from './RadialView.svelte';
</script>

<style>
  .saliency {
    display: flex;
    width: 100%;
    justify-content: space-around;
    margin-top: 20px;
  }
</style>


<div class='app-page'>

  <!-- <div class='saliency'>
    <GraphView />
  </div> -->
  
  <Main />

</div>
