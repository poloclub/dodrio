<script>
  import Main from './Main.svelte';
  import GraphView from './GraphView.svelte';
  import Saliency from './Saliency.svelte';
  import CircleView from './CircleView.svelte';
  import GridView from './GridView.svelte';
  import RadialView from './RadialView.svelte';
  import DependencyView from './Dependency.svelte';
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
  <!-- <Saliency width={950}/> -->
  <!-- <div class='saliency'>
    <GraphView />
    <DependencyView />
  </div> -->
  
  <Main />
  <!-- <RadialView /> -->
  <!-- <CircleView /> -->
  <!-- <GridView /> -->
</div>
