/*
 *
 * Octree.js
 * (sparse) 3D spatial representation structure for fast searches.
 * 
 * based on Octree by Marek Pawlowski @ pawlowski.it and Dynamic Octree by Piko3D @ http://www.piko3d.com/
 *
 * @author Collin Hover / http://collinhover.com/
 *
 */
(function (main) {
    
    var shared = main.shared = main.shared || {},
		assetPath = "assets/modules/core/Octree.js",
		_Octree = {},
		_ObjectHelper,
		octreeNodeCount = 0,
		depthMax = -1,
		objectsThreshold = 2,
		overlapPct = 0.1,
		indexInsideCross = -1,
		indexOutsideOffset = 2,
		posX = 0, negX = 1,
		posY = 2, negY = 3,
		posZ = 4, negZ = 5,
		FLAG_POS_X = 1 << 1,
		FLAG_NEG_X = 1 << 2,
		FLAG_POS_Y = 1 << 3,
		FLAG_NEG_Y = 1 << 4,
		FLAG_POS_Z = 1 << 5,
		FLAG_NEG_Z = 1 << 6,
		indexOutsideMap;
	
	/*===================================================
    
    public
    
    =====================================================*/
	
	init_internal();
	
	main.asset_register( assetPath, { 
		data: _Octree,
		requirements: [
			"assets/modules/utils/ObjectHelper.js"
		],
		callbacksOnReqs: init_internal,
		wait: true
	});
	
	/*===================================================
    
    internal init
    
    =====================================================*/
	
	function init_internal ( oh ) {
		console.log('internal octree', _Octree);
		
		_ObjectHelper = oh;
		
		// properties
		
		indexOutsideMap = [];
		indexOutsideMap[ posX ] = { index: posX, count: 0, x: 1, y: 0, z: 0 };
		indexOutsideMap[ negX ] = { index: negX, count: 0, x: -1, y: 0, z: 0 };
		indexOutsideMap[ posY ] = { index: posY, count: 0, x: 0, y: 1, z: 0 };
		indexOutsideMap[ negY ] = { index: negY, count: 0, x: 0, y: -1, z: 0 };
		indexOutsideMap[ posZ ] = { index: posZ, count: 0, x: 0, y: 0, z: 1 };
		indexOutsideMap[ negZ ] = { index: negZ, count: 0, x: 0, y: 0, z: -1 };
		
		// instance
		
		_Octree.Instance = Octree;
		
	}
	
	/*===================================================
    
    octree
    
    =====================================================*/
	
	function Octree ( parameters ) {
		
		// handle parameters
		
		parameters = parameters || {};
		
		parameters.tree = this;
		
		// TEST
		this.scene = parameters.scene;
		// TEST
		
		this.objects = [];
		this.depthMax = main.is_number( parameters.depthMax ) ? parameters.depthMax : depthMax;
		this.objectsThreshold = main.is_number( parameters.objectsThreshold ) ? parameters.objectsThreshold : objectsThreshold;
		this.overlapPct = main.is_number( parameters.overlapPct ) ? parameters.overlapPct : overlapPct;
		
		this.root = parameters.root instanceof OctreeNode ? parameters.root : new OctreeNode( parameters );
		
	}
	
	Octree.prototype.root_set = function ( root ) { 
		
		if ( root instanceof OctreeNode ) {
			
			// store new root
			
			this.root = root;
			
			// update properties
			
			properties_update_cascade.call( this.root );
			
		}
		
	};
	
	Octree.prototype.add = function ( object, splitByFaces ) {
		
		var i, l,
			geometry,
			faces;
		
		// if adding faces of object, instead of object itself
		
		if ( splitByFaces === true ) {
			
			if ( object instanceof OctreeObjectData ) {
				
				object = object.object;
				
			}
			
			geometry = object.geometry;
			faces = geometry.faces;
			
			for ( i = 0, l = faces.length; i < l; i++ ) {
				
				add_object.call( this.root, new OctreeObjectData( object, faces[ i ] ) );
				
			}
			
		}
		// else add object
		else {
			
			add_object.call( this.root, object instanceof OctreeObjectData ? object : new OctreeObjectData( object ) );
			
		}
		
	};
	
	Octree.prototype.remove = function ( object ) {
		
		remove_object.call( this.root, object );
		
	};
	
	Octree.prototype.update = function () {
		
		var i, l,
			node,
			objectData,
			indexOctant,
			indexOctantLast,
			positionObj,
			objectsUpdate = [];
		console.log( this, ' UPDATE!');
		// check all objects for changes in position
		
		for ( i = 0, l = this.objects.length; i < l; i++ ) {
			
			objectData = this.objects[ i ];
			
			node = objectData.node;
			
			var cp = objectData.position_current();
			
			// if position has changed since last organization of object in tree
			console.log( ' >  object has node? ', node instanceof OctreeNode, ' positions equal? ', objectData.positionLast.equals( cp ), ' current pos ', cp.x, cp.y, cp.z, ' last pos ', objectData.positionLast.x, objectData.positionLast.y, objectData.positionLast.z );
			if ( node instanceof OctreeNode && !objectData.positionLast.equals( objectData.position_current() ) ) {
				
				// get octant index of object within current node
				
				indexOctantLast = objectData.indexOctant;
				
				indexOctant = octant_index.call( node, objectData );
				console.log( ' > >  object new octant? ', indexOctant !== indexOctantLast );
				// if object octant index has changed
				
				if ( indexOctant !== indexOctantLast ) {
					
					// add to list for deferred update
					
					objectsUpdate.push( objectData );
					
				}
				
			}
			
		}
		console.log( '  ... objects to update', objectsUpdate);
		// update changed objects
		
		for ( i = 0, l = objectsUpdate.length; i < l; i++ ) {
			
			objectData = objectsUpdate[ i ];
			
			// remove object from current node
			
			remove_object.call( /*this.root*/objectData.node, objectData );
			
			// add object to tree root
			
			add_object.call( this.root, objectData );
			
		}
		
	};
	
	Octree.prototype.search = function ( position, radius ) {
		
		return search.call( this.root, position, radius, [], true );
		
	};
	
	Octree.prototype.depth_end = function () {
		
		return depth_end.call( this.root );
		
	};
	
	Octree.prototype.octree_count_end = function () {
		
		return octree_count_end.call( this.root );
		
	};
	
	Octree.prototype.object_count_end = function () {
		
		return object_count_end.call( this.root );
		
	};
	
	Octree.prototype.to_console = function ( space ) {
		
		to_console.call( this.root );
		
	};
	
	function to_console ( space ) {
		
		var i, l,
			node,
			spaceAddition = '   ';
		
		space = typeof space === 'string' ? space : spaceAddition;
		
		console.log( ( this.parent ? space + ' octree NODE > ' : ' octree ROOT > ' ), this, ' // id: ', this.id, ' // indexOctant: ', this.indexOctant, ' // position: ', this.position.x, this.position.y, this.position.z, ' // radius: ', this.radius, ' // depth: ', this.depth );
		console.log( ( this.parent ? space + ' ' : ' ' ), '+ objects ( ', this.objects.length, ' ) ', this.objects );
		console.log( ( this.parent ? space + ' ' : ' ' ), '+ children ( ', this.nodesIndices.length, ' )', this.nodesIndices, this.nodesByIndex );
		
		for ( i = 0, l = this.nodesIndices.length; i < l; i++ ) {
			
			node = this.nodesByIndex[ this.nodesIndices[ i ] ];
			
			to_console.call( node, space + spaceAddition );
			
		}
		
	};
	
	/*===================================================
    
    object data
    
    =====================================================*/
	
	function OctreeObjectData ( object, face ) {
		
		this.object = object;
		this.face = face;
		
		// properties by type
		
		if ( object instanceof THREE.Object3D ) {
			
			// ensure matrix world is calculated
			
			if ( object.matrixAutoUpdate !== true ) {
				
				object.updateMatrix();
				
			}
			object.updateMatrixWorld();
			
			this.matrix = object.matrixWorld;
			this.scale = object.scale;
			this.positionLast = new THREE.Vector3();
			this.utilVec31Position = new THREE.Vector3();
			
			if ( face instanceof THREE.Face3 || face instanceof THREE.Face4 ) {
				
				this.radius = _ObjectHelper.face_bounding_radius( object, face );
				this.offset = face.centroid;
				
			}
			else {
				
				this.radius = object.geometry.boundingSphere.radius;
				
			}
			
		}
		
	}
	
	OctreeObjectData.prototype.position_current = function () {
		
		var position;
		
		// ensure matrices are updated
		
		if ( this.object.matrixAutoUpdate !== true ) {
			
			this.object.updateMatrix();
			
		}
		this.object.updateMatrixWorld();
		
		// object face
		
		if ( typeof this.face !== 'undefined' ) {
			
			// get offset of face from object center
			
			position = this.utilVec31Position.copy( this.offset );
			
			// adjust for object world position, scale, and rotation
			
			this.matrix.multiplyVector3( position );
			
		}
		// object self
		else {
			
			position = this.matrix.getPosition();
			
		}
		
		return position;
		
	}
	
	/*===================================================
    
    node
    
    =====================================================*/
	
	function OctreeNode ( parameters ) {
		
		octreeNodeCount++;
		
		// utility
		
		this.utilVec31Branch = new THREE.Vector3();
		this.utilVec31Expand = new THREE.Vector3();
		this.utilVec31Search = new THREE.Vector3();
		
		// handle parameters
		
		parameters = parameters || {};
		
		// basic properties
		
		this.id = octreeNodeCount;
		this.position = parameters.position instanceof THREE.Vector3 ? parameters.position : new THREE.Vector3();
		this.radius = main.is_number( parameters.radius ) ? parameters.radius : 0;
		this.indexOctant = parameters.indexOctant;
		this.depth = 0;
		
		// reset and assign parent
		
		reset.call( this );
		this.parent = parameters.parent;
		
		// store or create tree
		
		if ( parameters.tree instanceof Octree ) {
			
			this.tree = parameters.tree;
			
		}
		else {
			
			parameters.root = this;
			
			this.tree = new Octree( parameters );
			
		}
		
		// additional properties
		
		this.overlap = this.radius * this.tree.overlapPct;
		
		// TEST
		this.visual = new THREE.Mesh( new THREE.CubeGeometry( ( this.radius + this.overlap ) * 2, ( this.radius + this.overlap ) * 2, ( this.radius + this.overlap ) * 2 ), new THREE.MeshLambertMaterial( { color: 0xFF0000, wireframe: true, wireframeLinewidth: 10 } ) );
		this.visual.position.copy( this.position );
		if ( this.tree.scene ) {
			this.tree.scene.add( this.visual );
		}
		// TEST
		
	}
	
	Object.defineProperty( OctreeNode.prototype, 'empty', { 
		get : function () { return this.nodesIndices.length === 0 && this.objects.length === 0; }
	} );
	
	Object.defineProperty( OctreeNode.prototype, 'parent', { 
		get : function () { return this._parent; },
		set : function ( parent ) {
			
			// store new parent
			
			if ( parent !== this ) {
				
				this._parent = parent;
				
			}
			
			// update properties
			
			properties_update_cascade.call( this );
			
		}
		
	} );
	
	function properties_update_cascade () {
		
		var i, l;
		
		// properties
		
		if ( this._parent instanceof OctreeNode ) {
			
			this.tree = this._parent.tree;
			this.depth = this._parent.depth + 1;
			
		}
		else {
			
			this.depth = 0;
			
		}
		
		// cascade
		
		for ( i = 0, l = this.nodesIndices.length; i < l; i++ ) {
			
			properties_update_cascade.call( this.nodesByIndex[ this.nodesIndices[ i ] ] );
			
		}
		
	}
	
	/*===================================================
    
    reset
    
    =====================================================*/
	
	function reset ( cascade, removeVisual ) {
		
		var i, l,
			node,
			nodesIndices = this.nodesIndices || [],
			nodesByIndex = this.nodesByIndex;
		
		this.objects = [];
		this.nodesIndices = [];
		this.nodesByIndex = {};
		
		// unset parent in nodes
		
		for ( i = 0, l = nodesIndices.length; i < l; i++ ) {
			
			node = nodesByIndex[ nodesIndices[ i ] ];
			
			node.parent = undefined;
			
			if ( cascade === true ) {
				
				reset.call( node, cascade, removeVisual );
				
			}
			
		}
		
		// TEST
		if ( removeVisual === true && this.tree.scene ) {
			this.tree.scene.remove( this.visual );
		}
		// TEST
	}
	
	/*===================================================
    
    octree add / remove
    
    =====================================================*/
	
	function add_octree ( octree, indexOctant ) {
		
		indexOctant = octree.indexOctant = main.is_number( indexOctant ) ? indexOctant : main.is_number( octree.indexOctant ) ? octree.indexOctant : octant_index.call( this, octree );
		
		if ( this.nodesIndices.indexOf( indexOctant ) === -1 ) {
			
			this.nodesIndices.push( indexOctant );
			
		}
		
		this.nodesByIndex[ indexOctant ] = octree;
		
		if ( octree.parent !== this ) {
			
			octree.parent = this;
			
		}
		
	}
	
	function remove_octree ( identifier ) {
		
		var indexOctant = -1,
			index,
			octree;
		
		// if identifier is octree
		if ( identifier instanceof OctreeNode && this.nodesByIndex[ identifier.indexOctant ] === identifier ) {
			
			octree = identifier;
			indexOctant = octree.indexOctant;
			
		}
		// if identifier is number
		else if ( main.is_number( identifier ) ) {
			
			indexOctant = identifier;
			
		}
		// else search all nodes for identifier (slow)
		else {
			
			for ( index in this.nodesByIndex ) {
				
				octree = this.nodesByIndex[ index ];
				
				if ( octree === identifier ) {
					
					indexOctant = index;
					
					break;
					
				}
				
			}
			
		}
		
		// if indexOctant found
		
		if ( indexOctant !== -1 ) {
			
			index = this.nodesIndices.indexOf( indexOctant );
			
			this.nodesIndices.splice( index, 1 );
			
			octree = octree || this.nodesByIndex[ indexOctant ];
			
			delete this.nodesByIndex[ indexOctant ];
			
			if ( octree.parent === this ) {
				
				octree.parent = undefined;
				
			}
			
		}
		
	}
	
	/*===================================================
    
    objects add / remove
    
    =====================================================*/
	
	function add_object ( object ) {
		
		var indexOctant,
			index,
			node;
		
		// get object octant index
		
		indexOctant = octant_index.call( this, object );
		
		// if object fully contained by an octant, add to subtree
		if ( indexOctant > -1 && this.nodesIndices.length > 0 ) {
			
			node = branch.call( this, indexOctant );
			
			add_object.call( node, object );
			
		}
		// if object lies outside bounds, add to parent node
		else if ( indexOctant < -1 && this.parent instanceof OctreeNode ) {
			
			add_object.call( this.parent, object );
			
		}
		// else add to self
		else {
			
			// add to this objects list
			
			index = this.objects.indexOf( object );
			
			if ( index === -1 ) {
				
				this.objects.push( object );
				
			}
			
			// add to tree objects list
			
			if ( !( object.node instanceof OctreeNode ) ) {
				
				this.tree.objects.push( object );
				
			}
			
			// node reference
			
			object.node = this;
			
			// check if need to expand, split, or both
			
			grow_check.call( this );
			
		}
		
	}
	
	function remove_object ( object ) {
		
		var i, l,
			nodesRemovedFrom,
			removeData;
		
		// cascade through tree to find and remove object
		
		removeData = remove_object_end.call( this, object, { searchComplete: false, nodesRemovedFrom: [] } );
		
		// if object removed, try to shrink the nodes it was removed from
		
		nodesRemovedFrom = removeData.nodesRemovedFrom;
		
		if ( nodesRemovedFrom.length > 0 ) {
			
			for ( i = 0, l = nodesRemovedFrom.length; i < l; i++ ) {
				
				shrink.call( nodesRemovedFrom[ i ] );
				
			}
			
		}
		
	}
	
	function remove_object_end ( object, removeData ) {
		
		var i, l,
			index = -1,
			objectData,
			node,
			objectRemoved;
		
		// find index of object in objects list
		
		// search and remove object data (fast)
		if ( object instanceof OctreeObjectData ) {
			
			// remove from this objects list
			
			index = this.objects.indexOf( object );
			
			if ( index !== -1 ) {
				
				remove_object_index_tree.call( this, index );
				
				removeData.searchComplete = objectRemoved = true;
				
			}
			
		}
		// search each object data for object and remove (slow)
		else {
			
			for ( i = this.objects.length - 1; i >= 0; i-- ) {
				
				if ( this.objects[ i ].object === object ) {
					
					objectData = remove_object_index_tree.call( this, i );
					
					objectRemoved = true;
					
					if ( !( objectData.face instanceof THREE.Face3 || objectData.face instanceof THREE.Face4 ) ) {
						
						removeData.searchComplete = true;
						break;
						
					}
					
				}
				
			}
			
		}
		
		// if object data removed and this is not on nodes removed from
		
		if ( objectRemoved === true && removeData.nodesRemovedFrom.indexOf( this ) === -1 ) {
			
			removeData.nodesRemovedFrom.push( this );
			
		}
		
		// if search not complete, search nodes
		
		if ( removeData.searchComplete !== true ) {
			
			for ( i = 0, l = this.nodesIndices.length; i < l; i++ ) {
				
				node = this.nodesByIndex[ this.nodesIndices[ i ] ];
				
				// try removing object from node
				
				removeData = remove_object_end.call( node, object, removeData );
				
				if ( removeData.searchComplete === true ) {
					
					break;
					
				}
				
			}
			
		}
		
		return removeData;
		
	}
	
	function remove_object_index_tree ( index ) {
		
		// remove from this objects list
		
		var objectRemoved = this.objects.splice( index, 1 )[ 0 ];
		
		// remove from tree objects list
		
		index = this.tree.objects.indexOf( objectRemoved );
		
		if ( index !== -1 ) {
			
			this.tree.objects.splice( index, 1 );
			
		}
		
		// node reference
		
		objectRemoved.node = undefined;
		
		return objectRemoved;
		
	}
	
	/*===================================================
    
    grow
    
    =====================================================*/
	
	function grow_check () {
		
		// if object count above max
		
		if ( this.objects.length > this.tree.objectsThreshold && this.tree.objectsThreshold > 0 ) {
			
			grow.call( this );
			
		}
		
	}
	
	function grow () {
		
		var objectsExpand = [],
			objectsExpandOctants = [],
			objectsSplit = [],
			objectsSplitOctants = [],
			objectsRemaining = [];
		
		// for each object
		
		for ( i = 0, l = this.objects.length; i < l; i++ ) {
			
			object = this.objects[ i ];
			
			// get object octant index
			
			indexOctant = octant_index.call( this, object );
			
			// if lies within octant
			if ( indexOctant > -1 ) {
				
				objectsSplit.push( object );
				objectsSplitOctants.push( indexOctant );
			
			}
			// if lies outside radius
			else if ( indexOctant < -1 ) {
				
				objectsExpand.push( object );
				objectsExpandOctants.push( indexOctant );
				
			}
			// else if lies across bounds between octants
			else {
				
				objectsRemaining.push( object );
				
			}
			
		}
		
		// if has objects to split
		
		if ( objectsSplit.length > 0) {
			
			objectsRemaining = objectsRemaining.concat( split.call( this, objectsSplit, objectsSplitOctants ) );
			
		}
		
		// if has objects to expand
		
		if ( objectsExpand.length > 0) {
			
			objectsRemaining = objectsRemaining.concat( expand.call( this, objectsExpand, objectsExpandOctants ) );
			
		}
		
		// store remaining
		
		this.objects = objectsRemaining;
		
		// merge check
		
		merge_check.call( this );
		
	}
	
	/*===================================================
    
    split
    
    =====================================================*/
	
	function split ( objects, octants ) {
		
		var i, l,
			indexOctant,
			object,
			node,
			objectsRemaining;
		
		// if not at max depth
		
		if ( this.tree.depthMax < 0 || this.depth < this.tree.depthMax ) {
			
			objects = objects || this.objects;
			
			octants = octants || [];
			
			objectsRemaining = [];
			
			// for each object
			
			for ( i = 0, l = objects.length; i < l; i++ ) {
				
				object = objects[ i ];
				
				// get object octant index
				
				indexOctant = main.is_number( octants[ i ] ) ? octants[ i ] : octant_index.call( this, object );
				
				// if object contained by octant, branch this tree
				
				if ( indexOctant > -1 ) {
					
					node = branch.call( this, indexOctant );
					
					add_object.call( node, object );
					
				}
				// else add to remaining
				else {
					
					objectsRemaining.push( object );
					
				}
				
			}
			
			// if all objects, set remaining as new objects
			
			if ( objects === this.objects ) {
				
				this.objects = objectsRemaining;
				
			}
			
		}
		else {
			
			objectsRemaining = this.objects;
			
		}
		
		return objectsRemaining;
		
	}
	
	function branch ( indexOctant ) {
		
		var node,
			overlap,
			radius,
			radiusOffset,
			offset,
			position;
		
		// node exists
		
		if ( this.nodesByIndex[ indexOctant ] instanceof OctreeNode ) {
			
			node = this.nodesByIndex[ indexOctant ];
			
		}
		// create new
		else {
			
			// properties
			
			radius = ( this.radius + this.overlap ) * 0.5;
			overlap = radius * this.tree.overlapPct;
			radiusOffset = radius - overlap;
			offset = this.utilVec31Branch.set( indexOctant & 1 ? radiusOffset : -radiusOffset, indexOctant & 2 ? radiusOffset : -radiusOffset, indexOctant & 4 ? radiusOffset : -radiusOffset );
			position = new THREE.Vector3().add( this.position, offset );
			
			// node
			
			node = new OctreeNode( {
				tree: this.tree,
				parent: this,
				position: position,
				radius: radius,
				indexOctant: indexOctant
			} );
			
			// store
			
			add_octree.call( this, node, indexOctant );
		
		}
		
		return node;
		
	}
	
	/*===================================================
    
    expand
    
    =====================================================*/
	
	function expand ( objects, octants ) {
		
		var i, l,
			object,
			objectsRemaining,
			objectsExpand,
			indexOctant,
			flagsOutside,
			indexOutside,
			indexOctantInverse,
			iom = indexOutsideMap,
			indexOutsideCounts,
			infoIndexOutside1,
			infoIndexOutside2,
			infoIndexOutside3,
			indexOutsideBitwise1,
			indexOutsideBitwise2,
			infoPotential1,
			infoPotential2,
			infoPotential3,
			indexPotentialBitwise1,
			indexPotentialBitwise2,
			octantX, octantY, octantZ,
			overlap,
			radius,
			radiusOffset,
			radiusParent,
			overlapParent,
			offset = this.utilVec31Expand,
			position,
			parent;
		
		// handle max depth down tree
		
		if ( this.tree.depthMax < 0 || depth_end.call( this.tree.root ) < this.tree.depthMax ) {
			
			objects = objects || this.objects;
			octants = octants || [];
			
			objectsRemaining = [];
			objectsExpand = [];
			
			iom[ posX ].count = iom[ negX ].count = iom[ posY ].count = iom[ negY ].count = iom[ posZ ].count = iom[ negZ ].count = 0;
			
			// for all outside objects, find outside octants containing most objects
			
			for ( i = 0, l = objects.length; i < l; i++ ) {
				
				object = objects[ i ];
				
				// get object octant index
				
				indexOctant = main.is_number( octants[ i ] ) ? octants[ i ] : octant_index.call( this, object );
				
				// if object outside this, include in calculations
				
				if ( indexOctant < -1 ) {
					
					// convert octant index to outside flags
					
					flagsOutside = -indexOctant - indexOutsideOffset;
					
					// check against bitwise flags
					
					// x
					
					if ( flagsOutside & FLAG_POS_X ) {
						
						iom[ posX ].count++;
						
					}
					else if ( flagsOutside & FLAG_NEG_X ) {
						
						iom[ negX ].count++;
						
					}
					
					// y
					
					if ( flagsOutside & FLAG_POS_Y ) {
						
						iom[ posY ].count++;
						
					}
					else if ( flagsOutside & FLAG_NEG_Y ) {
						
						iom[ negY ].count++;
						
					}
					
					// z
					
					if ( flagsOutside & FLAG_POS_Z ) {
						
						iom[ posZ ].count++;
						
					}
					else if ( flagsOutside & FLAG_NEG_Z ) {
						
						iom[ negZ ].count++;
						
					}
					
					// store in expand list
					
					objectsExpand.push( object );
					
				}
				// else add to remaining
				else {
					
					objectsRemaining.push( object );
					
				}
				
			}
			
			// if objects to expand
			
			if ( objectsExpand.length > 0 ) {
				
				// shallow copy index outside map
				
				indexOutsideCounts = iom.slice( 0 );
				
				// sort outside index count so highest is first
				
				indexOutsideCounts.sort( function ( a, b ) {
					
					return b.count - a.count;
					
				} );
				
				// get highest outside indices
				
				// first is first
				infoIndexOutside1 = indexOutsideCounts[ 0 ];
				indexOutsideBitwise1 = infoIndexOutside1.index | 1;
				
				// second is ( one of next two bitwise OR 1 ) that is not opposite of ( first bitwise OR 1 )
				
				infoPotential1 = indexOutsideCounts[ 1 ];
				infoPotential2 = indexOutsideCounts[ 2 ];
				
				infoIndexOutside2 = ( infoPotential1.index | 1 ) !== indexOutsideBitwise1 ? infoPotential1 : infoPotential2;
				indexOutsideBitwise2 = infoIndexOutside2.index | 1;
				
				// third is ( one of next three bitwise OR 1 ) that is not opposite of ( first or second bitwise OR 1 )
				
				infoPotential1 = indexOutsideCounts[ 2 ];
				infoPotential2 = indexOutsideCounts[ 3 ];
				infoPotential3 = indexOutsideCounts[ 4 ];
				
				indexPotentialBitwise1 = infoPotential1.index | 1;
				indexPotentialBitwise2 = infoPotential2.index | 1;
				
				infoIndexOutside3 = indexPotentialBitwise1 !== indexOutsideBitwise1 && indexPotentialBitwise1 !== indexOutsideBitwise2 ? infoPotential1 : indexPotentialBitwise2 !== indexOutsideBitwise1 && indexPotentialBitwise2 !== indexOutsideBitwise2 ? infoPotential2 : infoPotential3;
				
				// get this octant normal based on outside octant indices
				
				octantX = infoIndexOutside1.x + infoIndexOutside2.x + infoIndexOutside3.x;
				octantY = infoIndexOutside1.y + infoIndexOutside2.y + infoIndexOutside3.y;
				octantZ = infoIndexOutside1.z + infoIndexOutside2.z + infoIndexOutside3.z;
				
				// get this octant indices based on octant normal
				
				indexOctant = octant_index_from_xyz( octantX, octantY, octantZ );
				indexOctantInverse = octant_index_from_xyz( -octantX, -octantY, -octantZ );
				
				// properties
				
				overlap = this.overlap;
				radius = this.radius;
				
				// radius of parent comes from reversing overlap of this, unless overlap percent is 0
				
				radiusParent = this.tree.overlapPct > 0 ? overlap / ( ( 0.5 * this.tree.overlapPct ) * ( 1 + this.tree.overlapPct ) ) : radius * 2; 
				overlapParent = radiusParent * this.tree.overlapPct;
				
				// parent offset is difference between radius + overlap of parent and child
				
				radiusOffset = ( radiusParent + overlapParent ) - ( radius + overlap );
				offset.set( indexOctant & 1 ? radiusOffset : -radiusOffset, indexOctant & 2 ? radiusOffset : -radiusOffset, indexOctant & 4 ? radiusOffset : -radiusOffset );
				position = new THREE.Vector3().add( this.position, offset );
				
				// parent
				
				parent = new OctreeNode( {
					tree: this.tree,
					position: position,
					radius: radiusParent
				} );
				
				// set self as node of parent
				
				add_octree.call( parent, this, indexOctantInverse );
				
				// set parent as root
				
				this.tree.root_set( parent );
				
				// add all expand objects to parent
				
				for ( i = 0, l = objectsExpand.length; i < l; i++ ) {
					
					add_object.call( this.tree.root, objectsExpand[ i ] );
					
				}
				//add.call( parent, objectsExpand );
				
			}
			
			// if all objects, set remaining as new objects
			
			if ( objects === this.objects ) {
				
				this.objects = objectsRemaining;
				
			}
			
		}
		else {
			
			objectsRemaining = objects;
			
		}
		
		return objectsRemaining;
		
	}
	
	/*===================================================
    
    shrink
    
    =====================================================*/
	
	function shrink () {
		
		// merge check
		
		merge_check.call( this );
		
		// contract check
		
		contract_check.call( this.tree.root );
		
	}
	
	/*===================================================
    
    merge
    
    =====================================================*/
	
	function merge_check () {
		
		var nodeParent = this,
			nodeMerge;
		
		// traverse up tree as long as node + entire subtree's object count is under minimum
		
		while ( nodeParent.parent instanceof OctreeNode && object_count_end.call( nodeParent ) < this.tree.objectsThreshold ) {
			
			nodeMerge = nodeParent;
			nodeParent = nodeParent.parent;
			
		}
		
		// if parent node is not this, merge entire subtree into merge node
		
		if ( nodeParent !== this ) {
			
			merge.call( nodeParent, nodeMerge );
			
		}
		
	}
	
	function merge ( nodes ) {
		
		var i, l,
			node;
		
		// handle nodes
		
		nodes = main.ensure_array( nodes );
		
		for ( i = 0, l = nodes.length; i < l; i++ ) {
			
			node = nodes[ i ];
			
			// gather node + all subtree objects
			
			this.objects = this.objects.concat( objects_end.call( node ) );
			
			// reset node + entire subtree
			
			reset.call( node, true, true );
			
			// remove node
			
			remove_octree.call( this, node.indexOctant, node );
			
		}
		
		// merge check
		
		merge_check.call( this );
		
	}
	
	/*===================================================
    
    contract
    
    =====================================================*/
	
	function contract_check () {
		
		var i, l,
			node,
			nodeObjectsCount,
			nodeHeaviest,
			nodeHeaviestObjectsCount,
			outsideHeaviestObjectsCount;
		
		// find node with highest object count
		
		if ( this.nodesIndices.length > 0 ) {
			
			nodeHeaviestObjectsCount = 0;
			outsideHeaviestObjectsCount = this.objects.length;
			
			for ( i = 0, l = this.nodesIndices.length; i < l; i++ ) {
				
				node = this.nodesByIndex[ this.nodesIndices[ i ] ];
				
				nodeObjectsCount = object_count_end.call( node );
				outsideHeaviestObjectsCount += nodeObjectsCount;
				
				if ( nodeHeaviest instanceof OctreeNode === false || nodeObjectsCount > nodeHeaviestObjectsCount ) {
					
					nodeHeaviest = node;
					nodeHeaviestObjectsCount = nodeObjectsCount;
					
				}
				
			}
			
			// subtract heaviest count from outside count
			
			outsideHeaviestObjectsCount -= nodeHeaviestObjectsCount;
			
			// if should contract
			
			if ( outsideHeaviestObjectsCount < this.tree.objectsThreshold && nodeHeaviest instanceof OctreeNode ) {
				
				contract.call( this, nodeHeaviest );
				
			}
			
		}
		
	}
	
	function contract ( nodeRoot ) {
		
		var i, l,
			node;
		
		// handle all nodes
		
		for ( i = 0, l = this.nodesIndices.length; i < l; i++ ) {
			
			node = this.nodesByIndex[ this.nodesIndices[ i ] ];
			
			// if node is not new root
			
			if ( node !== nodeRoot ) {
				
				// add node + all subtree objects to root
				
				nodeRoot.objects = nodeRoot.objects.concat( objects_end.call( node ) );
				
				// reset node + entire subtree
				
				reset.call( node, true, true );
				
			}
			
		}
		
		// add own objects to root
		
		nodeRoot.objects = nodeRoot.objects.concat( this.objects );
		
		// reset self
		
		reset.call( this, false, true );
		
		// set new root
		
		this.tree.root_set( nodeRoot );
		
		// contract check on new root
		
		contract_check.call( nodeRoot );
		
	}
	
	/*===================================================
    
    octant
    
    =====================================================*/
	
	function octant_index ( objectData ) {
		
		var i, l,
			positionObj,
			radiusObj,
			position = this.position,
			radius = this.radius,
			overlap = this.overlap,
			radiusOverlap = radius + overlap,
			deltaX, deltaY, deltaZ,
			distX, distY, distZ, 
			distance,
			indexOctant = 0;
		
		// handle type
		
		// object data
		if ( objectData instanceof OctreeObjectData ) {
			
			radiusObj = objectData.radius * Math.max( objectData.scale.x, objectData.scale.y, objectData.scale.z );
			
			positionObj = objectData.position_current();
			
			// update object data position last
			
			objectData.positionLast.copy( positionObj );
			
		}
		// node
		else if ( objectData instanceof OctreeNode ) {
			
			radiusObj = 0;
			
		}
		
		// find delta and distance
		
		deltaX = positionObj.x - position.x;
		deltaY = positionObj.y - position.y;
		deltaZ = positionObj.z - position.z;
		
		distX = Math.abs( deltaX );
		distY = Math.abs( deltaY );
		distZ = Math.abs( deltaZ );
		distance = Math.max( distX, distY, distZ );
		
		// if outside, use bitwise flags to indicate on which sides object is outside of
		
		if ( distance + radiusObj > radiusOverlap ) {
			
			// x
			
			if ( distX + radiusObj > radiusOverlap ) {
				
				indexOctant = indexOctant ^ ( deltaX > 0 ? FLAG_POS_X : FLAG_NEG_X );
				
			}
			
			// y
			
			if ( distY + radiusObj > radiusOverlap ) {
				
				indexOctant = indexOctant ^ ( deltaY > 0 ? FLAG_POS_Y : FLAG_NEG_Y );
				
			}
			
			// z
			
			if ( distZ + radiusObj > radiusOverlap ) {
				
				indexOctant = indexOctant ^ ( deltaZ > 0 ? FLAG_POS_Z : FLAG_NEG_Z );
				
			}
			
			objectData.indexOctant = -indexOctant - indexOutsideOffset;
			
			return objectData.indexOctant;
			
		}
		
		// return octant index from delta xyz
		
		// x right
		if ( deltaX - radiusObj > -overlap ) {
			
			indexOctant = indexOctant | 1;
			
		}
		// x left
		else if ( !( deltaX + radiusObj < overlap ) ) {
			
			objectData.indexOctant = indexInsideCross;
			return objectData.indexOctant;
			
		}
		
		// y right
		if ( deltaY - radiusObj > -overlap ) {
			
			indexOctant = indexOctant | 2;
			
		}
		// y left
		else if ( !( deltaY + radiusObj < overlap ) ) {
			
			objectData.indexOctant = indexInsideCross;
			return objectData.indexOctant;
			
		}
		
		// z right
		if ( deltaZ - radiusObj > -overlap ) {
			
			indexOctant = indexOctant | 4;
			
		}
		// z left
		else if ( !( deltaZ + radiusObj < overlap ) ) {
			
			objectData.indexOctant = indexInsideCross;
			return objectData.indexOctant;
			
		}
		
		objectData.indexOctant = indexOctant;
		return objectData.indexOctant;
		
	}
	
	function octant_index_from_xyz ( x, y, z ) {
		
		var indexOctant = 0;
		
		if ( x > 0 ) {
			
			indexOctant = indexOctant | 1;
			
		}
		
		if ( y > 0 ) {
			
			indexOctant = indexOctant | 2;
			
		}
		
		if ( z > 0 ) {
			
			indexOctant = indexOctant | 4;
			
		}
		
		return indexOctant;
		
	}
	
	/*===================================================
    
    search
    
    =====================================================*/
	
	function search ( position, radius, objects, override ) {
		
		var i, l,
			node,
			delta,
			distance;
		
		// if is within distance
		
		delta = this.utilVec31Search.sub( position, this.position );
		distance = Math.max( Math.abs( delta.x ), Math.abs( delta.y ), Math.abs( delta.z ) );
		//console.log( this.id, ' > octree SEARCH cascade, this POS ', this.position.x, this.position.y, this.position.z, ' + this.radius ', this.radius, ' + delta ', delta.x, delta.y, delta.z, ' + distance ', distance, ' + is within? ', ( distance - radius <= this.radius ) );
		if ( ( distance - radius ) <= ( this.radius + this.overlap ) || override === true ) {
			
			// gather objects
			
			objects = ( objects || [] ).concat( this.objects );
			
			// search subtree
			
			for ( i = 0, l = this.nodesIndices.length; i < l; i++ ) {
				
				node = this.nodesByIndex[ this.nodesIndices[ i ] ];
				
				objects = search.call( node, position, radius, objects );
				
			}
			
		}
		
		return objects;
		
	}
	
	/*===================================================
    
    traversal
    
    =====================================================*/
	
	function depth_end ( depth ) {
		
		var i, l,
			node;

		if ( this.nodesIndices.length > 0 ) {

			for ( i = 0, l = this.nodesIndices.length; i < l; i++ ) {

				node = this.nodesByIndex[ this.nodesIndices[ i ] ];

				depth = depth_end.call( node, depth );

			}

		}
		else {

			depth = !depth || this.depth > depth ? this.depth : depth;

		}

		return depth;
		
	}
	
	function octree_count_end () {
		
		return octree_count_cascade.call( this.tree.root ) + 1;
		
	}
	
	function octree_count_cascade () {
		
		var i, l,
			count = this.nodesIndices.length;
		
		for ( i = 0, l = this.nodesIndices.length; i < l; i++ ) {
			
			count += octree_count_cascade.call( this.nodesByIndex[ this.nodesIndices[ i ] ] );
			
		}
		
		return count;
		
	}
	
	function objects_end ( objects ) {
		
		var i, l,
			node;
		
		objects = ( objects || [] ).concat( this.objects );
		
		for ( i = 0, l = this.nodesIndices.length; i < l; i++ ) {
			
			node = this.nodesByIndex[ this.nodesIndices[ i ] ];
			
			objects = objects_end.call( node, objects );
			
		}
		
		return objects;
		
	}
	
	function objects_end_limited ( depth, objects ) {
		
		var i, l,
			node;
		
		objects = ( objects || [] ).concat( this.objects );
		
		depth = main.is_number( depth ) ? depth : -1;
		
		if ( depth !== 0 ) {
			
			for ( i = 0, l = this.nodesIndices.length; i < l; i++ ) {
				
				node = this.nodesByIndex[ this.nodesIndices[ i ] ];
				
				objects = objects_end_limited.call( node, depth - 1, objects );
				
			}
			
		}
		
		return objects;
		
	}
	
	function object_count_end () {
		
		var i, l,
			count = this.objects.length;
		
		for ( i = 0, l = this.nodesIndices.length; i < l; i++ ) {
			
			count += object_count_end.call( this.nodesByIndex[ this.nodesIndices[ i ] ] );
			
		}
		
		return count;
		
	}
	
	function object_count_limited ( depth, excludeSelf ) {
		
		var i, l,
			count = excludeSelf === true ? 0 : this.objects.length;
		
		if ( depth > 0 ) {
			
			for ( i = 0, l = this.nodesIndices.length; i < l; i++ ) {
				
				count += object_count_limited.call( this.nodesByIndex[ this.nodesIndices[ i ] ], depth - 1 );
				
			}
			
		}
		
		return count;
		
	}
	
	function object_count_start () {
		
		var count = this.objects.length,
			parent = this.parent;
		
		while( parent instanceof OctreeNode ) {
			
			count += parent.objects.length;
			parent = parent.parent;
			
		}
		
		return count;
		
	}
	
} (KAIOPUA) );