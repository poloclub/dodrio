<script>
  import Saliency from './Saliency.svelte';

  let saliencyVisCount = 1;

  const increaseSaliencyVisCount = (evt) => {
    saliencyVisCount += 1;
  }
</script>

<style>
  .saliency {
    display: flex;
    width: 100%;
    justify-content: space-around;
    margin-top: 20px;
  }

  .add-saliency-vis {
  	display: flex;
    width: 100%;
    justify-content: space-around;
    margin-top: 20px;
  }
</style>

{#each {length: saliencyVisCount} as _, i}
    <div class='saliency'>
  		<Saliency width={950}/>
	</div>
{/each}

<div class="add-saliency-vis">
	<button class="button add-saliency" on:click={increaseSaliencyVisCount}><i class="fas fa-plus"></i></button>
</div>
